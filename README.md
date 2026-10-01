# Evolution.io Public Online Prototype

## Renderで公開する最短手順
1. このフォルダをGitHubリポジトリにアップロード
2. Renderで New > Web Service
3. GitHubリポジトリを選択
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Deploy
7. 発行された `https://xxxx.onrender.com` を開く

WebSocket/Socket.IOは同一サービス上で動作します。
独自ドメインもRender側から追加できます。
