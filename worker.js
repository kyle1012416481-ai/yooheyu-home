const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>yhy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    h1 {
      font-size: clamp(6rem, 20vw, 16rem);
      font-weight: 900;
      letter-spacing: 0.05em;
      background: linear-gradient(90deg, #a78bfa, #f472b6, #60a5fa, #a78bfa);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmer 4s linear infinite;
      user-select: none;
    }
    @keyframes shimmer {
      0%   { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    .glow {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(167,139,250,0.15), transparent 70%);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div><h1>yhy</h1></div>
</body>
</html>`;

export default {
  async fetch() {
    return new Response(HTML, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
