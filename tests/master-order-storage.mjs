import assert from 'node:assert/strict';
export async function verifyMasterOrderStorage(api) {
  const original = await api.createTriadicDatabase(2026);
  const initial = await api.readPlanContents(original);
  const alternating = [];
  for (let i=0;i<Math.max(initial.accounts.length,initial.aggregations.length);i++) {
    if(initial.accounts[i]) alternating.push({kind:'account',id:initial.accounts[i].id});
    if(initial.aggregations[i]) alternating.push({kind:'group',id:initial.aggregations[i].id});
  }
  let bytes = await api.changeAggregationMaster(original,{type:'reorder',order:alternating});
  let plan = await api.readPlanContents(bytes);
  assert.deepEqual(api.orderedMasterRows(plan.accounts,plan.aggregations),alternating);
  assert.deepEqual(plan.accounts.map(a=>a.id),alternating.filter(r=>r.kind==='account').map(r=>r.id));
  assert.deepEqual(plan.aggregations.map(a=>a.id),alternating.filter(r=>r.kind==='group').map(r=>r.id));
  assert.deepEqual(api.buildCostTable(plan.accounts,plan.aggregations,[],2026).filter(r=>r.kind!=='ratio').map(({kind,id})=>({kind,id})),alternating);
  const snapshot = await api.createBusinessSnapshot(bytes);
  const reversed = plan.accounts.map(a=>a.id).reverse();
  bytes = (await api.changeAccountMaster(bytes,{type:'reorder',ids:reversed})).bytes;
  let cursor=0; const swapped = alternating.map(row=>row.kind==='account'?{...row,id:reversed[cursor++]}:row);
  plan = await api.readPlanContents(bytes);
  assert.deepEqual(api.orderedMasterRows(plan.accounts,plan.aggregations),swapped,'科目だけの並べ替えは集計の位置を維持');
  bytes = await api.applyOperationSnapshot(bytes,snapshot);
  bytes = await api.changeAggregationMaster(bytes,{type:'add',name:'削除可能集計'});
  plan = await api.readPlanContents(bytes); const group = plan.aggregations.at(-1);
  assert.deepEqual(api.orderedMasterRows(plan.accounts,plan.aggregations).at(-1),{kind:'group',id:group.id});
  bytes = await api.changeAggregationMaster(bytes,{type:'delete',id:group.id});
  plan = await api.readPlanContents(bytes);
  assert.deepEqual(api.orderedMasterRows(plan.accounts,plan.aggregations),alternating);
  const db = await api.openTriadicDatabase(bytes);
  try {
    for(const table of ['accounts','aggregation_groups']) assert.ok(!db.exec(`PRAGMA table_info(${table})`)[0].values.some(row=>row[1]==='sort_order'));
    assert.equal(db.exec("SELECT value FROM triadic_metadata WHERE key='master_order'").length,0);
    const positions=db.exec('SELECT position FROM master_order ORDER BY position')[0].values.map(([p])=>p);
    assert.deepEqual(positions,alternating.map((_,i)=>i));
    const next=positions.length;
    assert.throws(()=>db.run('INSERT INTO master_order(position,account_id) VALUES (?,?)',[next,initial.accounts[0].id]),/UNIQUE/);
    assert.throws(()=>db.run('INSERT INTO master_order(position,account_id) VALUES (?,999999)',[next]),/FOREIGN/);
    assert.throws(()=>db.run('INSERT INTO master_order(position) VALUES (?)',[next]),/CHECK/);
    assert.throws(()=>db.run('INSERT INTO master_order(position,account_id,aggregation_group_id) VALUES (?,999998,999998)',[next]),/CHECK/);
    db.run('DELETE FROM master_order WHERE position=1');
    const incomplete=db.export(); const before=incomplete.slice();
    await assert.rejects(api.openTriadicDatabase(incomplete),/読み込めません/); assert.deepEqual(incomplete,before);
  } finally {db.close();}
  const metadataDb=await api.openTriadicDatabase(bytes);
  try {
    metadataDb.run("INSERT INTO triadic_metadata(key,value) VALUES ('master_order','[]')");
    await assert.rejects(api.openTriadicDatabase(metadataDb.export()),/形式/);
  } finally {metadataDb.close();}
  assert.deepEqual(await api.readPlanContents(original),initial);
  console.log('PASS: 唯一の参照付き順序、交互順・種類別部分列、追加削除・復元、重複・孤児・欠落・二重参照と旧JSON拒否');
}
