import test from 'node:test';
import assert from 'node:assert';
import { buildThreadBody, CommentThreadContextInput } from '../pr';

test('buildThreadBody - formato legado com apenas string de arquivo', () => {
  const filePath = 'JPCompcombr/index.ts';
  const comment = 'Comentário legado de teste';

  const body = buildThreadBody(filePath, comment);

  assert.strictEqual(body.comments.length, 1);
  assert.strictEqual(body.comments[0].content, comment);
  assert.strictEqual(body.threadContext.filePath, '/JPCompcombr/index.ts');
  assert.strictEqual(body.threadContext.rightFileStart, undefined);
  assert.strictEqual(body.threadContext.rightFileEnd, undefined);
});

test('buildThreadBody - novo formato com objeto CommentThreadContextInput e intervalo de linhas', () => {
  const contextInput: CommentThreadContextInput = {
    filePath: 'src/utils.ts',
    startLine: 10,
    endLine: 15
  };
  const comment = 'Refatorar bloco de código para evitar complexidade desnecessária';

  const body = buildThreadBody(contextInput, comment);

  assert.strictEqual(body.comments.length, 1);
  assert.strictEqual(body.comments[0].content, comment);
  assert.strictEqual(body.threadContext.filePath, '/src/utils.ts');
  assert.deepStrictEqual(body.threadContext.rightFileStart, { line: 10, offset: 1 });
  assert.deepStrictEqual(body.threadContext.rightFileEnd, { line: 15, offset: 1 });
});

test('buildThreadBody - quando apenas startLine é informado, endLine deve espelhar startLine', () => {
  const contextInput: CommentThreadContextInput = {
    filePath: '/src/main.ts',
    startLine: 42
  };
  const comment = 'Verificar possível valor nulo';

  const body = buildThreadBody(contextInput, comment);

  assert.strictEqual(body.threadContext.filePath, '/src/main.ts');
  assert.deepStrictEqual(body.threadContext.rightFileStart, { line: 42, offset: 1 });
  assert.deepStrictEqual(body.threadContext.rightFileEnd, { line: 42, offset: 1 });
});

test('buildThreadBody - suporte a linhas do lado esquerdo (leftFileStartLine/leftFileEndLine)', () => {
  const contextInput: CommentThreadContextInput = {
    filePath: 'deleted_code.ts',
    leftFileStartLine: 5,
    leftFileEndLine: 8
  };
  const comment = 'Remoção de método legado';

  const body = buildThreadBody(contextInput, comment);

  assert.strictEqual(body.threadContext.filePath, '/deleted_code.ts');
  assert.deepStrictEqual(body.threadContext.leftFileStart, { line: 5, offset: 1 });
  assert.deepStrictEqual(body.threadContext.leftFileEnd, { line: 8, offset: 1 });
});
