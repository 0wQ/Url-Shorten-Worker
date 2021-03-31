const randomStringLength = 6
const html_200 = `<!Doctype html><html><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
</head><body>
  <label>URL:</label>
  <input type="url" name="url" placeholder="https://example.com" pattern="^http(s)?://.*">
  <button>Button</button>
  <div></div>
  <script>
    const button = document.querySelector('button')
    const input = document.querySelector('input')
    const div = document.querySelector('div')
    button.addEventListener('click', () => handle())
    input.addEventListener('keyup', ({key}) => {
      if (key === 'Enter') handle()
    })
    function handle() {
      const url = input.value
      console.log(url)
      if (/^http(s)?:/.test(url)) {
        fetch('/api', {
          method: 'POST',
          body: JSON.stringify({ url: url }),
          headers: {
            'content-type': 'application/json'
          }
        }).then(res => res.json())
          .catch(e => {
            console.error('Error:', e)
          })
          .then(res => {
            console.log(res)
            if (!res.error) {
              const href = location.href + res.key
              div.innerHTML = '<p></p><a href="' + href + '" target="_blank">' + href + '</a></p>'
            } else {
              div.innerHTML = '<p style="color: red;">Error: ' + res.error.message + '</p>'
            }
          })
      }
    }
  </script>
</body></html>`
const html_404 = `<!Doctype html><html><body>
  <h1>404 Not Found.</h1>
  <p>The url you visit is not found.</p>
</body></html>`

addEventListener('fetch', async event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const path = new URL(request.url).pathname
  console.log(request.url, path)

  if (path === '/api' && request.method === 'POST') {
    const req = await request.json()
    console.log(req.url)

    if (!checkURL(req.url)) {
      return new Response(JSON.stringify({
        error: {
          code: 403,
          message: 'Url illegal.',
        }
      }), {
        status: 403,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      })
    }
    const random_key = await saveURL(req.url)
    console.log(random_key)
    if (random_key) {
      return new Response(JSON.stringify({
        key: random_key
      }), {
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      })
    } else {
      return new Response(JSON.stringify({
        error: {
          code: 500,
          message: 'Reach the KV write limitation.',
        }
      }), {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      })
    }
  }

  if (path === '/' || !path) {
    return new Response(html_200, {
      headers: {
        'content-type': 'text/html',
      },
    })
  }

  const key = path.split('/')[1]
  if (key.length === randomStringLength) {
    const location = await LINKS.get(key, { cacheTtl: 60 * 60 * 24 })
    console.log(location)
    if (location) return Response.redirect(location, 302)
  }

  return new Response(html_404, {
    status: 404,
    headers: {
      'content-type': 'text/html',
    },
  })
}

function randomString() {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
  const maxPos = chars.length
  let result = ''
  for (i = 0; i < randomStringLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return result
}

function checkURL(url) {
  return /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/.test(url) && url.length <= 1024 * 100
}

async function saveURL(url) {
  const random_key = randomString()
  return typeof (await LINKS.put(random_key, url)) === 'undefined' ? random_key : false
}
