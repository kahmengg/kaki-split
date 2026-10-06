import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Isolate the route to verify caller authorization without touching real records.
const directory = await mkdtemp(join(tmpdir(), 'kaki-delete-api-'))
const bundle = await build({ entryPoints: ['api/groups/delete-activity-item.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'auth-fixture', setup(builder) {
    builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'client', namespace: 'fixture' }))
    builder.onResolve({ filter: /_lib\/db\.js$/ }, () => ({ path: 'db', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({path}) => ({ contents: path === 'client'
      ? 'export const createClient = (...args) => globalThis.__deleteClient(...args)'
      : 'export const adminSupabase = {auth:{getUser:async token=>({data:{user:token==="valid"?{id:"actor"}:null},error:null})}}' }))
  } }],
})
const file = join(directory, 'route.mjs')
await writeFile(file, bundle.outputFiles[0].text)
const {default: handler} = await import(pathToFileURL(file))
test.after(async()=>{ delete globalThis.__deleteClient; await rm(directory,{recursive:true,force:true}) })
const body = {groupId:'g',itemId:'e',itemType:'expense',expectedRevision:3}
async function request(payload=body,token='valid') {
  const response={code:0,body:null,status(code){this.code=code;return this},json(data){this.body=data;return this}}
  await handler({method:'POST',headers:{authorization:`Bearer ${token}`},body:payload},response)
  return response
}
test('deletion forwards the caller JWT and revision to the permission checked transaction',async()=>{
  const calls=[]
  globalThis.__deleteClient=(_url,_key,options)=>{
    assert.equal(options.global.headers.Authorization,'Bearer valid')
    assert.equal(options.auth.persistSession,false)
    return {rpc:async(...args)=>{calls.push(args);return {data:{ok:true},error:null}}}
  }
  assert.equal((await request()).code,200)
  assert.deepEqual(calls,[['delete_group_expense',{p_group_id:'g',p_expense_id:'e',p_expected_revision:3}]])
})
test('invalid authentication, stale clients and payment deletion cannot reach the deletion transaction',async()=>{
  globalThis.__deleteClient=()=>{throw Error('Must not reach database deletion')}
  assert.equal((await request(body,'invalid')).code,401)
  assert.equal((await request({...body,expectedRevision:undefined})).code,409)
  assert.equal((await request({...body,itemType:'payment'})).code,409)
})
