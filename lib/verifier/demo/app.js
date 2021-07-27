const express = require('express')
// const expressStaticGzip = require('express-static-gzip');
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use(express.static('public'))
app.use(express.static('../build'))

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})