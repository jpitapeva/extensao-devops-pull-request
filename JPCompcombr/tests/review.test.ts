import test from 'node:test';
import assert from 'node:assert';
import { parseReviewFeedback } from '../review';

test('parseReviewFeedback - retorna array vazio quando a resposta for "Sem feedback"', () => {
  const result1 = parseReviewFeedback('Sem feedback');
  assert.deepStrictEqual(result1, []);

  const result2 = parseReviewFeedback('"Sem feedback"');
  assert.deepStrictEqual(result2, []);
});

test('parseReviewFeedback - realiza o parse correto do retorno em formato JSON com múltiplos arquivos e linhas', () => {
  const jsonResponse = JSON.stringify([
    {
      filePath: 'src/index.ts',
      startLine: 10,
      endLine: 12,
      comment: 'Tratar possível nulo nesta atribuição'
    },
    {
      filePath: 'src/services/api.ts',
      startLine: 45,
      endLine: 50,
      comment: 'Adicionar timeout para evitar travamento da requisição HTTP'
    }
  ]);

  const result = parseReviewFeedback(jsonResponse);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].filePath, 'src/index.ts');
  assert.strictEqual(result[0].startLine, 10);
  assert.strictEqual(result[0].endLine, 12);
  assert.strictEqual(result[0].comment, 'Tratar possível nulo nesta atribuição');

  assert.strictEqual(result[1].filePath, 'src/services/api.ts');
  assert.strictEqual(result[1].startLine, 45);
  assert.strictEqual(result[1].endLine, 50);
});

test('parseReviewFeedback - suporta resposta contida dentro de bloco markdown ```json ```', () => {
  const markdownResponse = `Aqui estão as observações do review:
\`\`\`json
[
  {
    "filePath": "JPCompcombr/pr.ts",
    "startLine": 25,
    "endLine": 30,
    "comment": "Validar se o status de retorno da API é 200 OK"
  }
]
\`\`\``;

  const result = parseReviewFeedback(markdownResponse);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].filePath, 'JPCompcombr/pr.ts');
  assert.strictEqual(result[0].startLine, 25);
  assert.strictEqual(result[0].endLine, 30);
  assert.strictEqual(result[0].comment, 'Validar se o status de retorno da API é 200 OK');
});

test('parseReviewFeedback - fallback para formato legado (texto livre markdown sem JSON)', () => {
  const textResponse = `### Problema Identificado
O método \`run\` não possui tratamento para timeout.`;

  const result = parseReviewFeedback(textResponse, 'JPCompcombr/index.ts');

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].filePath, 'JPCompcombr/index.ts');
  assert.strictEqual(result[0].startLine, undefined);
  assert.strictEqual(result[0].endLine, undefined);
  assert.strictEqual(result[0].comment, textResponse);
});
