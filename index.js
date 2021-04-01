const randomStringLength = 6
const html_200 = `<!Doctype html><html>
<head><meta content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
<title>Short URL</title>
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
const html_404 = `<!Doctype html><html>
<head><meta content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
<title>404 Not Found</title>
</head><body>
  <h1>404 Not Found.</h1>
  <p>The url you visit is not found.</p>
</body></html>`

addEventListener('fetch', async event => {
  try {
    return event.respondWith(handleRequest(event))
  } catch (e) {
    return event.respondWith(new Response('Error thrown ' + e.message))
  }
})

async function handleRequest(event) {
  const request = event.request
  const body = await request.clone().text()
  const hash = await sha256(body)
  const cacheUrl = new URL(request.url)
  cacheUrl.pathname = `/${request.method}${cacheUrl.pathname}${hash}`
  const cacheKey = new Request(cacheUrl.toString(), {
    // headers: request.headers,
    method: 'GET',
  })
  const cache = caches.default
  let response = await cache.match(cacheKey)

  if (!response) {
    const path = new URL(request.url).pathname
    console.log(request.url, path)
    switch (path) {
      case '':
      case '/':
      case '/index.html':
        response = new Response(html_200, {
          headers: {
            'content-type': 'text/html',
            'cache-control': `public, maxage=${60 * 60}, s-maxage=${60 * 30}`,
          },
        })
        break
      case '/api':
        response = await handleApiRequest(request)
        break
      default:
        response = await handleRedirectRequest(path) || new Response(html_404, {
          status: 404,
          headers: {
            'content-type': 'text/html',
            'cache-control': `public, maxage=${60 * 10}, s-maxage=${60 * 1}`,
          },
        })
    }
    event.waitUntil(cache.put(cacheKey, response.clone()))
  }
  return response

  async function handleApiRequest(request) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        error: {
          code: 405,
          message: 'Method not allowed.',
        }
      }), {
        status: 405,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'cache-control': `s-maxage=${60 * 1}`,
        },
      })
    }

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
          'cache-control': `s-maxage=${60 * 1}`,
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
          'cache-control': `s-maxage=${60 * 60 * 24}`,
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

  async function handleRedirectRequest(path) {
    const key = path.split('/')[1]
    const location = await LINKS.get(key, { cacheTtl: 60 * 10 })
    console.log(location)
    // if (location) return Response.redirect(location, 302)
    if (location) return new Response('', {
      status: 302,
      headers: {
        'location': location,
        'cache-control': 's-maxage=60',
      },
    })
  }
}

function randomString() {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678' /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
  const maxPos = chars.length
  let result = ''
  for (i = 0; i < randomStringLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return result
}

function checkURL(url) {
  return url.length <= 1024 * 100 && /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/.test(url)
}

async function saveURL(url) {
  const random_key = randomString()
  return typeof (await LINKS.put(random_key, url)) === 'undefined' ? random_key : false
}

async function sha256(message) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message)
  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  // convert bytes to hex string
  const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('')
  return hashHex
}