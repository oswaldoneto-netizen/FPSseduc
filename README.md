# FPS 3D Online

## Rodar localmente
1. Instale Node.js 18+.
2. Rode `npm install`.
3. Rode `npm start`.
4. Abra `http://localhost:3000`.

## Render
- Crie um Web Service apontando para este repositório.
- Build Command: `npm install`
- Start Command: `npm start`
- O servidor usa `process.env.PORT`.

## Recursos
- FPS 3D no navegador.
- Multiplayer com Socket.IO.
- Spawn aleatório.
- Tiros/dano/eliminações sincronizados.
- Controles PC e celular.
- Level sobe ao eliminar outro jogador.
- Leaderboard Top 10 atualizado a cada 5 segundos.
- Som simples gerado no navegador, sem arquivos externos de áudio.
- O leaderboard e os níveis ficam em memória enquanto o servidor estiver rodando. Para persistência mesmo após reiniciar o Render, troque o Map por banco de dados (ex.: PostgreSQL).
