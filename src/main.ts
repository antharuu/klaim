import klaim from './klaim/klaim'

klaim.create.api('test', 'https://jsonplaceholder.typicode.com')

klaim.get.api('test')

const randomId = (): number => Math.round(Math.random() * 200)

const r1 = klaim.create.route('route1', 'get', '/todos/[id:num]').on('test')
const r1b = await r1.call({
  id: randomId()
})
console.log(r1b)

const r2 = await klaim.get.route('route1').call({ id: randomId() })
console.log(r2)

const r3 = await klaim.call('route1', { id: randomId() })
console.log(r3)
