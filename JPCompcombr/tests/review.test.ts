import test from 'node:test';
import assert from 'node:assert';
import { parseReviewFeedback, extractResponseText } from '../review';

test('extractResponseText - lê o texto de respostas do Azure Responses API com content em blocos', () => {
  const result = extractResponseText({
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: '[{"filePath":"src/index.ts","startLine":3,"endLine":6,"comment":"Tratar possível nulo antes de usar a variável."}]'
          }
        ]
      }
    ]
  });

  assert.strictEqual(result, '[{"filePath":"src/index.ts","startLine":3,"endLine":6,"comment":"Tratar possível nulo antes de usar a variável."}]');
});

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

test('parseReviewFeedback - aceita array JSON real do modelo com markdown e quebras de linha escapadas', () => {
  const jsonResponse = `[
  {
    "filePath": "sample.js",
    "startLine": 3,
    "endLine": 3,
    "comment": "Uso de \`var\` e variável aparentemente não utilizada.\\n\\nProblema:\\n- \`var unsafe = 'do not use';\` usa \`var\` (escopo de função, hoisting) e o identificador sugere que não deveria existir/é inseguro. Variáveis não usadas aumentam ruído e possível superfície de ataque.\\n\\nSolução recomendada:\\n- Remover a variável se não for necessária.\\n- Caso seja necessária, declare explicitamente com \`const\` ou \`let\` e escolha um nome descritivo.\\n\\nExemplo:\\n\`\`\`js\\n// remover se não for usado\\nconst SOME_CONFIG = 'valor';\\n\`\`\`"
  },
  {
    "filePath": "sample.js",
    "startLine": 4,
    "endLine": 6,
    "comment": "Função com práticas inseguras: uso de \`console.log(arguments)\` e \`eval()\`.\\n\\nProblemas:\\n- \`console.log('args', arguments)\` pode vazar dados sensíveis (credenciais, tokens) e não é adequado para produção; além disso \`arguments\` é um objeto pouco explícito.\\n- \`eval('var x = 5')\` é uma vulnerabilidade (execução dinâmica de código), afeta performance e facilita injeção.\\n\\nSoluções recomendadas:\\n- Substituir \`console.log\` por um logger configurável (ex.: \`debug\`, \`winston\`), e logar apenas dados explicitamente permitidos. Use parâmetros nomeados ou rest params em vez de \`arguments\`.\\n- Remover \`eval\`. Se precisar avaliar expressões, use um parser/avaliador seguro ou lógica explícita. Nunca execute código do cliente com \`eval\`.\\n\\nExemplo de refatoração:\\n\`\`\`js\\nconst logger = require('./logger'); // logger configurado\\nfunction secureFunction(...args) {\\n  logger.debug({ args }); // log controlado\\n  const x = 5; // eliminar uso de eval\\n  return x;\\n}\\n\`\`\`\\n\\nObservação: não exporte (module.exports) funções que preservem \`eval\`/logs indiscriminados até que sejam sanitizadas."
  },
  {
    "filePath": "sample.js",
    "startLine": 9,
    "endLine": 9,
    "comment": "Atribuição a variável global implícita.\\n\\nProblema:\\n- \`anotherGlobal = 'oops';\` cria/aceita uma variável global implícita, o que causa efeitos colaterais difíceis de depurar e falha em \`strict mode\`.\\n\\nSolução recomendada:\\n- Declarar com \`const\`/\`let\` no escopo apropriado ou anexar explicitamente ao \`module.exports\` se for API pública.\\n\\nExemplo:\\n\`\`\`js\\nconst anotherGlobal = 'oops';\\n// ou\\nmodule.exports = { insecure, anotherGlobal };\\n\`\`\`"
  }
]`;

  const result = parseReviewFeedback(jsonResponse);

  assert.strictEqual(result.length, 3);
  assert.ok(result[0].comment.includes('Uso de `var`'));
  assert.ok(result[1].comment.includes('console.log(arguments)'));
  assert.ok(result[2].comment.includes('anotherGlobal'));
});

test('parseReviewFeedback - ignora itens sem comentário válido', () => {
  const jsonResponse = JSON.stringify([
    { filePath: 'src/a.ts', startLine: 1, endLine: 1 },
    { filePath: 'src/b.ts', comment: '   ' },
    { filePath: 'src/c.ts', comment: 'Comentário válido', startLine: 2, endLine: 2 }
  ]);

  const result = parseReviewFeedback(jsonResponse);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].filePath, 'src/c.ts');
  assert.strictEqual(result[0].comment, 'Comentário válido');
});

test('parseReviewFeedback - aceita JSON em string escapada com texto adicional', () => {
  const response = 'Resumo: ["[{\\"filePath\\":\\"src/secure.js\\",\\"startLine\\":10,\\"endLine\\":12,\\"comment\\":\\"Evite eval em produção\\"}]"]';

  const result = parseReviewFeedback(response);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].filePath, 'src/secure.js');
  assert.strictEqual(result[0].comment, 'Evite eval em produção');
});

test('extractResponseText - combina múltiplos blocos de saída_text em um único texto', () => {
  const result = extractResponseText({
    output: [
      { type: 'message', content: [{ type: 'output_text', text: 'Primeiro trecho' }] },
      { type: 'message', content: [{ type: 'output_text', text: 'Segundo trecho' }] }
    ]
  });

  assert.strictEqual(result, 'Primeiro trecho\nSegundo trecho');
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
