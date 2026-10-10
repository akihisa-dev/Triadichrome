import assert from 'node:assert/strict';
export async function verifyAggregationRebase(api) {
  const base = await api.createTriadicDatabase(2026);
  const contents = await api.readPlanContents(base);
  const members = contents.aggregations.flatMap(group => group.members.map(member => ({ ...member, parentId: group.id })));
  const external = await api.saveKindSelection(base, 'initiative-list', [1]);
  const memberships = async bytes => (await api.readPlanContents(bytes)).aggregations;
  for (const index of [0, Math.floor(members.length / 2), members.length - 1]) {
    const member = members[index];
    const local = await api.changeAggregationMaster(base, {type:'move', member, parentId:member.parentId, sign:member.sign === 1 ? -1 : 1});
    const beforeCopies = [base, local, external].map(bytes => bytes.slice());
    const merged = await api.rebasePlan(base, local, external);
    assert.ok(merged?.operation, '符号変更を無視しない');
    assert.deepEqual(await memberships(merged.bytes), await memberships(local), '無関係な所属を全保持');
    assert.deepEqual((await api.readPlanContents(merged.bytes)).kindSelections['initiative-list'], [1]);
    const undone = await api.applyOperationSnapshot(merged.bytes, merged.operation.before);
    assert.deepEqual(await memberships(undone), await memberships(base));
    assert.deepEqual((await api.readPlanContents(undone)).kindSelections['initiative-list'], [1]);
    assert.deepEqual(await memberships(await api.applyOperationSnapshot(undone, merged.operation.after)), await memberships(local));
    assert.ok((await api.readDataHistory(merged.bytes)).entries.length);
    [base, local, external].forEach((bytes, i) => assert.deepEqual(bytes, beforeCopies[i]));
  }
  const member = members.find(item => item.kind === 'account');
  for (const parentId of [null, contents.aggregations.find(group => group.id !== member.parentId).id]) {
    const local = await api.changeAggregationMaster(base, {type:'move',member,parentId,sign:1});
    const result = await api.rebasePlan(base, local, external);
    assert.ok(result);
    assert.deepEqual(await memberships(result.bytes), await memberships(local));
  }
  const unassigned = await api.changeAggregationMaster(base, {type:'move',member,parentId:null,sign:1});
  const readded = await api.changeAggregationMaster(unassigned, {type:'move',member,parentId:member.parentId,sign:-1});
  assert.deepEqual(await memberships((await api.rebasePlan(unassigned,readded,await api.saveKindSelection(unassigned,'initiative-list',[1]))).bytes), await memberships(readded));
  const local = await api.changeAggregationMaster(base,{type:'move',member,parentId:member.parentId,sign:-1});
  const conflicting = await api.changeAggregationMaster(base,{type:'move',member,parentId:null,sign:1});
  assert.equal(await api.rebasePlan(base,local,conflicting),null);
  assert.equal((await api.rebasePlan(base,local,local)).operation,null);
  let stored = external;
  const handle = {name:'合成.triadic', async getFile() {return new File([stored],this.name);}, async createWritable() {
    let pending;
    return {async write(bytes) {pending = new Uint8Array(bytes);},async close() {stored = pending;},async abort() {}};
  }};
  const saved = await api.writePlanChange({...contents,bytes:base,name:handle.name,handle},handle,local,{allowRebase:true});
  assert.deepEqual(await memberships(stored),await memberships(local),'保存成功後の読戻し');
  assert.ok(saved.rebasedOperation);
  const account = members.find(item => item.kind === 'account' && members.some(other => other.kind === 'group' && other.id === item.id));
  const group = members.find(item => item.kind === 'group' && item.id === account.id);
  const left = await api.changeAggregationMaster(base,{type:'move',member:account,parentId:account.parentId,sign:-1});
  const right = await api.changeAggregationMaster(base,{type:'move',member:group,parentId:group.parentId,sign:-1});
  const both = await memberships((await api.rebasePlan(base,left,right)).bytes);
  for (const item of [account,group]) assert.equal(both.find(g => g.id === item.parentId).members.find(m => m.kind === item.kind && m.id === item.id).sign,-1);
  if (api.readRebaseRows) {
    const db = await api.openTriadicDatabase(base);
    try { for (const table of api.BUSINESS_TABLES) assert.equal(api.readRebaseRows(db,table).size, db.exec(`SELECT * FROM ${table}`)[0]?.values.length ?? 0); }
    finally { db.close(); }
    const mock = (columns,values) => ({exec: sql => [{values:sql.startsWith('PRAGMA') ? columns : values}]});
    const column = (name,pk) => [0,name,'TEXT',0,null,pk];
    for (const [columns,values] of [[[column('id',0)],[]],[[column('id',1)],[[null]]],[[column('id',1)],[[1],[1]]]]) {
      assert.throws(() => api.readRebaseRows(mock(columns,values),'future_table'));
    }
    for (const values of [[[null,null]],[[1,2]],[[1,null],[1,null]]]) assert.throws(() => api.readRebaseRows(mock([column('account_id',0),column('group_id',0)],values),'aggregation_members'));
  }
  console.log('PASS: 集計所属の先頭・中間・末尾・親変更・解除再追加の統合、同数値IDの種別、相反変更拒否、全行保持、取消・履歴・入力bytes保護と行キー検証');
}
