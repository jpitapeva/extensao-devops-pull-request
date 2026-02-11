import fetch from 'node-fetch';
import { git } from './git';
import { addCommentToPR } from './pr';
import * as https from 'https';
import * as http from 'http';

export let consumeApi: string;
export async function reviewFile(
  gitDiff: string,
  fileName: string,
  agent: http.Agent | https.Agent,
  apiKey: string,
  aoiEndpoint: string,
  tokenMax: string | undefined,
  temperature: string | undefined,
  prompt: string | undefined,
  additionalPrompts: string[] = [],
) {
  console.log(`Iniciando revisao do arquivo: ${fileName} ...`);

  let instructions : string;
if(prompt === null ||  prompt === '' || prompt === undefined) {
  instructions = `
  Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs).

  **Objetivo Principal:**
  Sua missão é analisar as alterações de código fornecidas e fornecer feedback construtivo para **melhorar a saúde geral do código**, garantindo qualidade, manutenibilidade, performance e segur[...] 

  **Formato de Entrada:**
  Você receberá as alterações do PR em formato de patch. Cada entrada contém a mensagem de commit seguida pelas alterações de código (diffs) em formato unidiff.

  **Instruções Detalhadas para Revisão:**
  Analise o código fornecido com base nos seguintes critérios. Para cada ponto levantado, explique o problema e, sempre que possível, sugira uma solução ou alternativa clara e acionável.

  1.  **Design e Arquitetura:**
      * A solução está bem desenhada e se integra adequadamente ao sistema existente?
      * A arquitetura da mudança é sólida e segue princípios como SOLID?
      * Evita complexidade desnecessária ou *over-engineering* (funcionalidades não solicitadas)?
      * Considera a manutenibilidade e extensibilidade futuras?

  2.  **Funcionalidade e Correção:**
      * Identifique possíveis bugs, erros lógicos ou comportamentos inesperados.
      * Verifique se todos os casos de borda relevantes foram considerados e tratados.
      * A funcionalidade implementada corresponde ao propósito original da tarefa/issue?

  3.  **Legibilidade e Manutenibilidade (Código Limpo):**
      * O código segue as boas práticas de código limpo? É fácil de ler, entender e modificar?
      * A nomenclatura (variáveis, funções, classes, etc.) é clara, significativa, consistente e segue as convenções estabelecidas?
      * Os comentários são úteis, claros e explicam o *porquê* (a intenção) em vez do *o quê* (que o código já diz)? Evita comentários redundantes ou desatualizados?
      * Há duplicação de código que pode ser refatorada para um componente reutilizável?

  4.  **Performance:**
      * As alterações podem introduzir gargalos ou impactar negativamente o desempenho (latência, uso de CPU/memória)?
      * Existem oportunidades claras e significativas para otimização de desempenho (escolha de algoritmos/estruturas de dados, otimização de queries, redução de I/O)? Sugira otimizações espec[...] 

  5.  **Segurança:**
      * Identifique vulnerabilidades conhecidas ou potenciais introduzidas pela mudança (e.g., SQL Injection, XSS, tratamento inadequado de dados sensíveis).
      * As melhores práticas de segurança estão sendo seguidas (validação de entrada, sanitização de dados, controle de acesso, tratamento seguro de erros)?

  6.  **Testes:**
      * (Se informações sobre testes estiverem disponíveis ou puderem ser inferidas do contexto ou código) Os testes automatizados (unitários, integração, etc.) são adequados, cobrem as novas [...] 
      * Os testes são bem escritos, legíveis e fáceis de manter?

  7.  **Documentação:**
      * (Se aplicável e informações disponíveis) A documentação relevante (READMEs, comentários de documentação de API/funções, etc.) foi adicionada ou atualizada para refletir as mudanças[...] 

  **Instruções Adicionais Específicas:**
  ${
    additionalPrompts && additionalPrompts.length > 0 ? additionalPrompts
          .map((str) => `- ${str.trim()}`)
          .filter(Boolean)
          .join('\n')
      : null
  }

  **Formato da Saída:**
  * Apresente o feedback de forma clara e estruturada, idealmente agrupado pelos critérios acima (Design, Funcionalidade, etc.).
  * Para cada ponto, indique o arquivo e a linha relevante, se aplicável.
  * Se nenhum problema ou ponto de melhoria for identificado em *nenhum* dos critérios, responda **apenas** com a frase: Sem feedback
  `;
}
else {  
  instructions = prompt;
}

  try {
    let choices: any;
    let response: any;

    if (tokenMax === undefined || tokenMax === '') {
      tokenMax = '100';
      console.log(`tokenMax fora dos parametros, para proseguir com a task foi setado para 100.`);
    }
    if (temperature === undefined || temperature === '' || parseInt(temperature) > 2) {
      temperature = '0';
      console.log(`temperatura fora dos parametros, para proseguir, a task foi setada para 0.`);
    }

    try {
      const request = await fetch(aoiEndpoint, {
        method: 'POST',
        headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: parseInt(`${tokenMax}`),
          temperature: parseInt(`${temperature}`),
          messages: [
            {
              role: 'user',
              content: `${instructions}\n, patch : ${gitDiff}`,
            },
          ],
        }),
      });

      response = await request.json();

      choices = response.choices;
    } catch (responseError: any) {
      console.log(
        `Encontrado erro, validar os parametros de entrada. ${responseError.response.status} ${responseError.response.message}`,
      );
    }

    if (choices && choices.length > 0) {
        const reviewOK = choices[0].message?.content as string;
        if (reviewOK.trim() !== 'Sem feedback') {
          await addCommentToPR(fileName, reviewOK, agent);
        } else {
          // Add a confirmation comment when no issues are found
          await addCommentToPR(fileName, '✅ Review completed: No issues found', agent);
        }
        console.log(`Revisão do arquivo ${fileName} concluída.`);
    } else {
      console.log(`Nenhum feedback encontrado para o arquivo ${fileName}.`);
    }
    // Captura o consumo de tokens

    try {
      const completion_tokens_total = response.usage.completion_tokens;
      const prompt_tokens_total = response.usage.prompt_tokens;
      const total_tokens_total = response.usage.total_tokens;

      consumeApi = `Uso: Completions: ${completion_tokens_total}, Prompts: ${prompt_tokens_total}, Total: ${total_tokens_total}`;
    } catch (error: any) {
      console.log(`Erro ao tentar capturar consumo de tokens: ${error.message}`);
    }
  } catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}
