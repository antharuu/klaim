import klaim from "./klaim/klaim";

klaim.create.api('test', 'http://localhost:3000//api/v2/?jambon=fromage&test=1')

klaim.get.api('test')

const r1 = klaim.create.route('route1', 'post', '/test')
const r1b = await r1.call()
console.log(r1b)

const r2 = await klaim.get.route('route1').call()
console.log(r2)

const r3 = await klaim.call('route1')
console.log(r3)
