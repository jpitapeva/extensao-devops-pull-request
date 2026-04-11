import fetch from 'node-fetch';
import * as https from 'https';
import * as http from 'http';

export let consumeApi: string = 'Uso: Informação não disponível';
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
  model_name: string | undefined,
  agent_foundry_mode: boolean | undefined,
  agent_name: string | undefined,
  agent_version: string | undefined
): Promise<string> {
  console.log(`Iniciando revisao do arquivo: ${fileName} ...`);

  let instructions: string;
  const noFeedbackMarker = 'Sem feedback';

  if (prompt === null || prompt === '' || prompt === undefined) {
    instructions = `Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs).

          ## Objetivo Principal
          Sua missão é analisar as alterações de código fornecidas e fornecer feedback construtivo para **melhorar a saúde geral do código**, garantindo qualidade, manutenibilidade, performance e segurança. O feedback deve ser técnico, didático, focado no código (não no autor) e explicar claramente o *raciocínio* por trás de cada ponto levantado. Priorize a identificação de problemas que realmente impactam a qualidade e a funcionalidade, diferenciando entre problemas críticos e sugestões menores (nits).

          ## Formato de Entrada
          Você receberá as alterações do PR em formato de patch. Cada entrada contém a mensagem de commit seguida pelas alterações de código (diffs) em formato unidiff.

          ## Instruções Detalhadas para Revisão
          Analise o código fornecido com base nos seguintes critérios. Para cada ponto levantado, explique o problema e, sempre que possível, sugira uma solução ou alternativa clara e acionável.

          ### 1. Design e Arquitetura
          - A solução está bem desenhada e se integra adequadamente ao sistema existente?
          - A arquitetura da mudança é sólida e segue princípios como SOLID?
          - Evita complexidade desnecessária ou *over-engineering* (funcionalidades não solicitadas)?
          - Considera a manutenibilidade e extensibilidade futuras?

          ### 2. Funcionalidade e Correção
          - Identifique possíveis bugs, erros lógicos ou comportamentos inesperados.
          - Verifique se todos os casos de borda relevantes foram considerados e tratados.
          - A funcionalidade implementada corresponde ao propósito original da tarefa/issue?

          ### 3. Legibilidade e Manutenibilidade (Código Limpo)
          - O código segue as boas práticas de código limpo? É fácil de ler, entender e modificar?
          - A nomenclatura (variáveis, funções, classes, etc.) é clara, significativa, consistente e segue as convenções estabelecidas?
          - Os comentários são úteis, claros e explicam o *porquê* (a intenção) em vez do *o quê* (que o código já diz)? Evita comentários redundantes ou desatualizados?
          - Há duplicação de código que pode ser refatorada para um componente reutilizável?

          ### 4. Performance
          - As alterações podem introduzir gargalos ou impactar negativamente o desempenho (latência, uso de CPU/memória)?
          - Existem oportunidades claras e significativas para otimização de desempenho (escolha de algoritmos/estruturas de dados, otimização de queries, redução de I/O)? Sugira otimizações específicas e justifique-as.

          ### 5. Segurança
          - Identifique vulnerabilidades conhecidas ou potenciais introduzidas pela mudança (e.g., SQL Injection, XSS, tratamento inadequado de dados sensíveis).
          - As melhores práticas de segurança estão sendo seguidas (validação de entrada, sanitização de dados, controle de acesso, tratamento seguro de erros)?

          ### 6. Testes
          - (Se informações sobre testes estiverem disponíveis ou puderem ser inferidas do contexto ou código) Os testes automatizados (unitários, integração, etc.) são adequados, cobrem as novas funcionalidades.
          - Os testes são bem escritos, legíveis e fáceis de manter?

          ### 7. Documentação
          - (Se aplicável e informações disponíveis) A documentação relevante (READMEs, comentários de documentação de API/funções, etc.) foi adicionada ou atualizada para refletir as mudanças no código?

          ## Instruções Adicionais Específicas
          ${additionalPrompts && additionalPrompts.length > 0 ? additionalPrompts
        .map((str) => `- ${str.trim()}`)
        .filter(Boolean)
        .join('\n')
        : null
      }

          ## Formato da Saída
          - Apresente o feedback de forma clara e estruturada, idealmente agrupado pelos critérios acima (Design, Funcionalidade, etc.).
          - Para cada ponto, indique o arquivo e a linha relevante, se aplicável.
          - Se nenhum problema ou ponto de melhoria for identificado em *nenhum* dos critérios, responda **apenas** com a frase: ${noFeedbackMarker}`;
  }
  else {
    // Append no-feedback instruction to custom prompt to ensure consistent behavior
    instructions = `${prompt}
    
    **IMPORTANTE - Formato de Resposta:**
    - Se você NÃO encontrar nenhum problema, erro, ou ponto de melhoria, responda APENAS com a frase exata: ${noFeedbackMarker}
    - Se você encontrar problemas ou sugestões, forneça o feedback detalhado normalmente.`;
  }

  try {
    let choices: any;
    let response: any = { usage: undefined }; // Initialize to avoid undefined in token capture

    if (agent_foundry_mode === true && (agent_name === undefined || agent_name === '' || agent_version === undefined || agent_version === '')) {
      console.log(`No agent_foundry_mode fica obrigatorio informar os parametros corretos do agent_name e agent_version.`);
      console.log('##vso[task.complete result=Failed;]');
    }
    if (tokenMax === undefined || tokenMax === '') {
      tokenMax = '100';
      console.log(`tokenMax fora dos parametros, para proseguir com a task foi setado para 100.`);
    }
    if (temperature === undefined || temperature === '') {
      temperature = '1';
      console.log(`temperatura fora dos parametros, para proseguir, a task foi setada para 1.`);
    }
    if (model_name === undefined || model_name === '') {
      console.log(`A partir da versão 31 é obrigatorio informar o nome correto do modelo configurado dentro do Portal da Azure Foundry. Exemplo: gpt-5.4-nano, gpt-35-turbo, gpt-4-32k, gpt-4-0613, gpt-4-32k-0613, gpt-4-1106-preview, gpt-4-1106, etc. Verificar a documentação para mais detalhes: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?tabs=global-standard-aoai%2Cglobal-standard&pivots=azure-openai`);
      console.log('##vso[task.complete result=Failed;]');
      return 'Erro: parametros de entrada inválidos';
    }

    // Validate temperature is a valid number between 0 and 2
    const tempValue = parseFloat(temperature);
    if (isNaN(tempValue) || tempValue < 0 || tempValue > 2) {
      temperature = '1';
      console.log(`temperatura invalida, para proseguir, a task foi setada para 1.`);
    }

    if (agent_foundry_mode === false || agent_foundry_mode === undefined) {
      try {
        const request = await fetch(aoiEndpoint, {
          method: 'POST',
          headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model_name,
            max_completion_tokens: parseInt(`${tokenMax}`),
            temperature: parseFloat(`${temperature}`),
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs)'
              },
              {
                role: 'user',
                content: `${instructions}\n, patch : ${gitDiff}`,
              },
            ],
          }),
          agent: agent
        });

        response = await request.json();

        // Validate response structure
        if (!response || typeof response !== 'object' || !response.choices || response === http.STATUS_CODES[400] || response === http.STATUS_CODES[401] || response === http.STATUS_CODES[403] || response === http.STATUS_CODES[404] || response === http.STATUS_CODES[500]) {
          console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${response?.error?.code}  MESSAGE: ${response?.error?.message} TYPE: ${response?.error?.type} PARAM: ${response?.error?.param}`);
          console.log('##vso[task.complete result=Failed;]');
          return 'Erro: resposta invalida da API, verificar todos os parametros de entrada como nome do modelo, token, link e a configuração do Azure OpenAI ou Azure Foundry.';
        }

        choices = response.choices;
      } catch (responseError: any) {
        console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${responseError.response?.error?.code}  MESSAGE: ${responseError.response?.error?.message} TYPE: ${responseError.response?.error?.type} PARAM: ${responseError.response?.error?.param}`);
        console.log(`Erro completo: ${responseError.message}`);
        console.log('##vso[task.complete result=Failed;]');
        return 'Erro ao comunicar com Azure OpenAI, verificar todos os parametros de entrada e a configuração do Azure OpenAI ou Azure Foundry.';
      }

      // Captura o consumo de tokens
      try {
        const completion_tokens_total = response.usage?.completion_tokens ?? response.usage?.completionTokens ?? 0;
        const prompt_tokens_total = response.usage?.prompt_tokens ?? response.usage?.promptTokens ?? 0;
        const total_tokens_total = response.usage?.total_tokens ?? response.usage?.totalTokens ?? 0;

        consumeApi = `Usage: Completions: ${completion_tokens_total}, Prompts: ${prompt_tokens_total}, Total: ${total_tokens_total}`;
      } catch (error: any) {
        console.log(`Erro ao tentar capturar consumo de tokens: ${error.message}`);
        consumeApi = `Usage: Informação indisponivel`;
        console.log('##vso[task.complete result=Failed;]');
      }

      if (choices && choices.length > 0) {
        const reviewOK = choices[0].message?.content;

        // Validate that content exists and is not empty
        if (!reviewOK || typeof reviewOK !== 'string' || reviewOK.trim().length === 0) {
          console.log(`Resposta vazia ou invalida do Azure OpenAI para arquivo ${fileName}.`);
          return noFeedbackMarker;
        }

        console.log(`Revisão do arquivo ${fileName} concluída.`);
        return reviewOK;
      } else {
        console.log(`Nenhum feedback encontrado para o arquivo ${fileName}.`);
        return noFeedbackMarker;
      }
    }
    else {
      try {
        const request = await fetch(aoiEndpoint, {
          method: 'POST',
          headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model_name,
            max_output_tokens: parseInt(`${tokenMax}`),
            agent_reference:
            {
              name: agent_name,
              version: agent_version,
              type: "agent_reference",
            },
            input: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em engenharia de software, atuando como revisor de código para Pull Requests (PRs)'
              },
              {
                role: 'user',
                content: `${instructions}\n, patch : ${gitDiff}`,
              },
            ],
          }),
          agent: agent
        });

        response = await request.json();

        // Validate response structure
        if (!response || typeof response !== 'object' || response === http.STATUS_CODES[400] || response === http.STATUS_CODES[401] || response === http.STATUS_CODES[403] || response === http.STATUS_CODES[404] || response === http.STATUS_CODES[500]) {
          console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${response?.error?.code}  MESSAGE: ${response?.error?.message} TYPE: ${response?.error?.type} PARAM: ${response?.error?.param}`);
          console.log('##vso[task.complete result=Failed;]');
          return 'Erro: resposta invalida da API, verificar todos os parametros de entrada como nome do modelo, token, link e a configuracao do Azure OpenAI ou Azure Foundry.';
        }
      } catch (responseError: any) {
        console.log(`Encontrado erro, validar os parametros de entrada. CODE: ${responseError?.error?.code}  MESSAGE: ${responseError?.error?.message} TYPE: ${responseError?.error?.type} PARAM: ${responseError?.error?.param}`);
        console.log('##vso[task.complete result=Failed;]');
        return 'Erro ao comunicar com Azure OpenAI, verificar todos os parametros de entrada e a configuracao do Azure OpenAI ou Azure Foundry.';
      }

      // Captura o consumo de tokens
      try {
        const output_tokens = response.usage?.output_tokens ?? response.usage?.output_tokens ?? 0; // Adjusted for potential differences in usage reporting
        const input_tokens = response.usage?.input_tokens ?? response.usage?.input_tokens ?? 0;
        const total_tokens = response.usage?.total_tokens ?? response.usage?.total_tokens ?? 0;

        consumeApi = `Usage: Input: ${input_tokens}, Output: ${output_tokens}, Total: ${total_tokens}`;
      } catch (error: any) {
        console.log(`Erro ao tentar capturar consumo de tokens: ${error.message}`);
        consumeApi = `Usage: Informação indisponível`;
        console.log('##vso[task.complete result=Failed;]');
      }

      const output = response.output?.content?.[0]?.text;
      if (output && output.length > 0) {
        const reviewOK = output.trim();

        // Validate that content exists and is not empty
        if (!reviewOK || typeof reviewOK !== 'string' || reviewOK.trim().length === 0) {
          console.log(`Resposta vazia ou invalida do Azure OpenAI para arquivo ${fileName}.`);
          return noFeedbackMarker;
        }

        console.log(`Revisão do arquivo ${fileName} concluída.`);
        return reviewOK;
      } else {
        console.log(`Nenhum feedback encontrado para o arquivo ${fileName}.`);
        return noFeedbackMarker;
      }
    }
  } catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
      console.log('##vso[task.complete result=Failed;]');
    } else {
      console.log(error.message);
      console.log('##vso[task.complete result=Failed;]');
    }
    return 'Erro ao processar revisão';
  }
}
