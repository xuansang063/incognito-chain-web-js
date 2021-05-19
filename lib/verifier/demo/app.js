const express = require('express')
const expressStaticGzip = require('express-static-gzip');
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use(express.static('public'))
app.use(expressStaticGzip('../build/'))
// app.use('/wasm', ('../../../wasm/build'))
// app.use('/wasm/wasm_exec.js', express.static('../wasm_exec.js'))

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})