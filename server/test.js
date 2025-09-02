import express from 'express';
const app = express();

app.get('/', (req, res) => res.send('Works!'));
app.get('/test/:id', (req, res) => res.json({ param: req.params.id }));

app.listen(3000, () => console.log('Test server running on port 3000'));