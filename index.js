import { StreamCamera, Codec } from "pi-camera-connect"

const EventEmitter = require('events')
const express = require('express')
const { performance } = require('perf_hooks')
const app = express()
const port = process.env.port || 9000
const root = __dirname
const Stream = new EventEmitter()

const runApp = async () => {

    const streamCamera = new StreamCamera({
        codec: Codec.H264
    })

    const videoStream = streamCamera.createStream()
    await streamCamera.startCapture()

    // We can also listen to data events as they arrive
    videoStream.on('data', data => {
      Stream.emit('push', 'test', JSON.stringify(data))
    })
    videoStream.on('end', data => console.log('Video stream has ended'))

}

function generateUUID() {
  return String(new Date().getTime() + performance.now()).replace('.', '-')
}
let resConnections = new Map()

Stream.on('push', (event, data) => {
  resConnections.forEach((res) => {
    if (!res || res.finished) return
    res.write(`event: ${String(event)}\n`)
    res.write(`id: ${new Date().getTime()}\n`)
    res.write(`data: ${JSON.stringify(data)}\n`)
    res.write('retry: 10000\n')
    res.write('\n')
  })
})

function closeConnections(event) {
  return new Promise(resolve => {
    resConnections.forEach((res) => {
      if (!res || res.finished) return
      res.write(`event: ${String(event)}\n`)
      res.write(`id: CLOSE\n`)
      res.write(`data: close\n`)
      res.write('\n')
      res.end()
    })
    console.log('End Stream')
    resolve(true)
  })
}

app.use(express.static(root))

app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
})

app.get('/', function (request, response) {
  response.render('index.html', {})
})

app.get('/stream', function (request, response) {
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream',
  })

  if (request.headers['last-event-id']) {
    const eventId = parseInt(request.headers['last-event-id'])
    console.log(eventId)
  }

  // This might not be needed with HTTP/2.0
  const clientID = generateUUID()
  resConnections.set(clientID, response)

  request.on('close', () => {
    if (!response.finished) {
      response.end()
      resConnections.delete(clientID)
      console.log('Stopped sending events to', clientID)
    }
  })

})


let httpInstance = app.listen(port)
runApp()

process.on('SIGINT', async () => {
  console.log('gracefully shutting down')
  clearInterval(timer)
  await closeConnections('test')
  httpInstance.close()
  process.exit(0)
})
