import assert from 'node:assert/strict';
export async function verifyUnifiedMaster(api) {
  let bytes=await api.createTriadicDatabase(2026);
  let contents=await api.readPlanContents(bytes);
  const original=api.buildCostTable(contents.accounts,contents.aggregations,[],2026).filter(row => row.kind !== 'ratio');
  assert.deepEqual(api.orderedMasterRows(contents.accounts,contents.aggregations),original.map(({kind,id})=>({kind,id})));
  const account=contents.accounts[0], group=contents.aggregations.find(item => !item.required);
  const order=api.orderedMasterRows(contents.accounts,contents.aggregations);
  const baseline=new Map(contents.accounts.map((item,index)=>[item.id,{4:(index+1)*1000}]));
  const valuesBefore=api.buildCostTable(contents.accounts,contents.aggregations,[],2026,baseline).map(({kind,id,budget})=>({kind,id,budget})).sort((a,b)=>`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const moved=[order.find(row => row.kind==='group' && row.id===group.id),...order.filter(row => !(row.kind==='group' && row.id===group.id))];
  bytes=await api.changeAggregationMaster(bytes,{type:'reorder',order:moved});
  contents=await api.readPlanContents(bytes);
  assert.deepEqual(api.buildCostTable(contents.accounts,contents.aggregations,[],2026).filter(row=>row.kind!=='ratio').map(({kind,id})=>({kind,id})),moved,'集計を先頭へ移しても共通順をそのまま使う');
  assert.deepEqual(api.buildCostTable(contents.accounts,contents.aggregations,[],2026,baseline).map(({kind,id,budget})=>({kind,id,budget})).sort((a,b)=>`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)),valuesBefore,'集計が計算元の前にあっても金額・利益率を変えない');
  const snapshot=await api.createBusinessSnapshot(bytes);
  const unchangedMembers=structuredClone(contents.aggregations.map(item=>({id:item.id,members:item.members})));
  bytes=await api.changeAggregationMaster(bytes,{type:'move',member:{kind:'account',id:account.id},parentId:null,sign:1});
  contents=await api.readPlanContents(bytes);
  assert.deepEqual(api.orderedMasterRows(contents.accounts,contents.aggregations),moved,'所属変更で行順を動かさない');
  bytes=await api.applyOperationSnapshot(bytes,snapshot);
  contents=await api.readPlanContents(bytes);
  assert.deepEqual(contents.aggregations.map(item=>({id:item.id,members:item.members})),unchangedMembers,'取り消しで所属・共通順を一緒に復元');
  const change={type:'update',id:account.id,accountCode:account.accountCode,accountType:account.accountType};
  bytes=(await api.changeAccountMaster(bytes,{...change,accountName:'改名した売上'})).bytes;
  contents=await api.readPlanContents(bytes);
  assert.equal(api.buildCostTable(contents.accounts,contents.aggregations,[],2026).find(row=>row.kind==='account'&&row.id===account.id).name,'改名した売上');
  bytes=(await api.changeAccountMaster(bytes,{...change,accountName:'改名した売上',displayName:'売上表示'})).bytes;
  bytes=(await api.changeAccountMaster(bytes,{...change,accountName:'再改名した売上'})).bytes;
  contents=await api.readPlanContents(bytes);
  assert.equal(contents.accounts.find(item=>item.id===account.id).displayName,'売上表示','独自表示名を名称変更でも保持');
  const namedSnapshot = await api.createBusinessSnapshot(bytes);
  const resetName = (await api.changeAccountMaster(bytes,{...change,accountName:'再改名した売上',displayName:'再改名した売上'})).bytes;
  assert.equal((await api.readPlanContents(resetName)).accounts.find(item=>item.id===account.id).displayName, undefined, '正式名と同じ場合は属性を省略する');
  const resetDb = await api.openTriadicDatabase(resetName);
  try {
    assert.equal(resetDb.exec('SELECT display_name FROM accounts WHERE id = ?',[account.id])[0].values[0][0], null);
    resetDb.run("INSERT INTO triadic_metadata(key,value) VALUES('account_display_names','{}')");
    const invalid = resetDb.export(); const before = invalid.slice();
    await assert.rejects(api.openTriadicDatabase(invalid), /形式/,'旧表示名辞書を新形式へ混在させない');
    assert.deepEqual(invalid,before);
  } finally { resetDb.close(); }
  bytes = await api.applyOperationSnapshot(resetName,namedSnapshot);
  assert.equal((await api.readPlanContents(bytes)).accounts.find(item=>item.id===account.id).displayName,'売上表示','履歴の元データから独自表示名を復元する');
  const ordinary=contents.aggregations.find(item=>item.required==='ordinary');
  bytes=await api.changeAggregationMaster(bytes,{type:'update',id:group.id,name:'集計の改名',members:group.members});
  contents=await api.readPlanContents(bytes);
  assert.equal(contents.aggregations.find(item=>item.id===group.id).displayName,group.displayName,'初期設定の小計の表示名を保持');
  await assert.rejects(api.changeAggregationMaster(bytes,{type:'reorder',order:moved.slice(1)}),/一致/);
  await assert.rejects(api.changeAggregationMaster(bytes,{type:'reorder',order:[moved[0],...moved.slice(0,-1)]}),/一致/);
  await assert.rejects(api.changeAggregationMaster(bytes,{type:'move',member:{kind:'group',id:ordinary.id},parentId:ordinary.id,sign:1}),/循環/);
  await assert.rejects(api.changeAccountMaster(bytes,{...change,accountName:'再改名した売上',displayName:' '}),/表示名/);
  bytes=(await api.changeAccountMaster(bytes,{type:'add',accountCode:'998',accountName:'削除用',accountType:'expense',displayName:'別表示'})).bytes;
  contents=await api.readPlanContents(bytes);const added=contents.accounts.find(item=>item.accountCode==='998');
  assert.deepEqual(api.orderedMasterRows(contents.accounts,contents.aggregations).at(-1),{kind:'account',id:added.id});
  bytes=(await api.changeAccountMaster(bytes,{type:'delete',id:added.id})).bytes;
  await api.validateTriadicDatabase(bytes);
  const db=await api.openTriadicDatabase(bytes);
  try {
    assert.equal(db.exec("SELECT value FROM triadic_metadata WHERE key='account_display_names'").length, 0, '表示名のJSON辞書を保存しない');
    assert.equal(db.exec("SELECT display_name FROM accounts WHERE id = ?", [added.id]).length, 0, '科目の削除と表示名の削除が同じ行で完結する');
    assert.equal(db.exec("SELECT display_name FROM accounts WHERE id = ?", [account.id])[0].values[0][0], '売上表示');
    assert.throws(() => db.run("UPDATE accounts SET display_name = ' ' WHERE id = ?", [account.id]), /CHECK/);
  } finally {db.close();}
  contents=await api.readPlanContents(bytes);
  for (const kind of ['account','group']) {
    const parent=contents.aggregations.find(item=>item.members.some(member=>member.kind===kind));
    const member=parent.members.find(item=>item.kind===kind);
    const beforeOrder=api.orderedMasterRows(contents.accounts,contents.aggregations);
    const beforeMembers=structuredClone(parent.members);
    const beforeDb=await api.openTriadicDatabase(bytes);
    let beforePositions;
    try { beforePositions=beforeDb.exec("SELECT parent_id,account_id,group_id,position FROM aggregation_members ORDER BY parent_id,position")[0].values; } finally {beforeDb.close();}
    bytes=await api.changeAggregationMaster(bytes,{type:'move',member:{kind,id:member.id},parentId:parent.id,sign:member.sign===1 ? -1 : 1,presentationOrder:beforeOrder});
    contents=await api.readPlanContents(bytes);
    assert.deepEqual(contents.aggregations.find(item=>item.id===parent.id).members,beforeMembers.map(item=>item.kind===kind&&item.id===member.id ? {...item,sign:-item.sign} : item),'符号だけの変更は所属内の順序と他の対象を維持');
    assert.deepEqual(api.orderedMasterRows(contents.accounts,contents.aggregations),beforeOrder);
    const afterDb=await api.openTriadicDatabase(bytes);
    try {assert.deepEqual(afterDb.exec("SELECT parent_id,account_id,group_id,position FROM aggregation_members ORDER BY parent_id,position")[0].values,beforePositions);} finally {afterDb.close();}
  }
  {
  // The combined preparation must preserve amounts, derived start months, history and undo.
  const sample=await api.createSamplePlan(2026);
  const original=await api.readPlanContents(sample);
  const owner=original.aggregations.find(group=>group.members.some(member=>member.kind==='account'));
  const child=owner.members.find(member=>member.kind==='account');
  const change={type:'move',member:{kind:'account',id:child.id},parentId:owner.id,sign:-child.sign,presentationOrder:api.orderedMasterRows(original.accounts,original.aggregations)};
  const prepare=api.processingTasks.prepareAggregationSave;
  const prepared=await prepare(sample,change,true,'2026-10-10T00:00:00.000Z');
  assert.deepEqual(prepared.contents,await api.readPlanContents(prepared.bytes));
  assert.deepEqual(prepared.contents,await api.readPlanContents(await api.changeAggregationMaster(sample,change)), 'shared preparation has the same business result');
  assert.deepEqual(prepared.contents.initiatives,original.initiatives);
  assert.deepEqual(await api.readSnapshotContents(prepared.operation.before),original);
  assert.deepEqual(await api.readSnapshotContents(prepared.operation.after),prepared.contents);
  assert.deepEqual(prepared.savedHistory,await api.readDataHistory(prepared.bytes));
  const oldHistory=await api.readDataHistory(sample);
  assert.deepEqual(prepared.savedHistory.entries,oldHistory.entries,'existing checkpoints survive preparation');
  for (const entry of oldHistory.entries) assert.deepEqual(await api.readHistorySnapshot(prepared.bytes,entry.id),await api.readHistorySnapshot(sample,entry.id));
  const fresh=await api.createTriadicDatabase(2026);
  const initialSave=await prepare(fresh,{...change,presentationOrder:undefined},true,'2026-10-10T00:00:00.000Z');
  assert.deepEqual(await api.readSnapshotContents(await api.readHistorySnapshot(initialSave.bytes,initialSave.savedHistory.entries[0].id)),await api.readPlanContents(fresh),'first save preserves the original business state');
  const unchanged=await prepare(prepared.bytes,change,true,'2026-10-10T00:01:00.000Z');
  assert.equal(unchanged.operation,null,'same sign must not add an undo operation');
  assert.deepEqual(unchanged.savedHistory,prepared.savedHistory,'five-minute deadline and history entries remain unchanged');
  await assert.rejects(prepare(sample,{type:'move',member:{kind:'group',id:owner.id},parentId:owner.id,sign:1}),/自分|循環/);
  await assert.rejects(prepare(new Uint8Array([1,2,3]),change));
  assert.deepEqual(await api.readPlanContents(sample),original,'failed preparation cannot mutate original bytes');
  }
  console.log('PASS: unified master order, membership, shared save, amount/start-month protection, history, undo and invalid edits');
}
