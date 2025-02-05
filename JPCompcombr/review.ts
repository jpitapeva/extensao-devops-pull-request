import fetch from 'node-fetch';
import { git } from './git';
import { addCommentToPR } from './pr';
import * as https from 'https';
import * as http from 'http';


export let consumeApi : string;
export async function reviewFile(gitDiff: string, fileName: string, agent: http.Agent | https.Agent, apiKey: string, aoiEndpoint: string, tokenMax: string | undefined, temperature: string | undefined, additionalPrompts: string[] = []) {
  console.log(`Iniciando revisao do arquivo: ${fileName} ...`);

  const instructions = `Você é um assistente do ramo de desenvolvimento de software.
                        Sua missão é atuar como um revisor de código de um Pull Request, fornecendo feedback sobre possíveis bugs e boas práticas de código limpo, sendo didático e fazendo o uso de linguagem técnica.
                        Você recebe as alterações do Pull Request em formato de patch, cada entrada de patch tem a mensagem de commit na linha de assunto seguida pelas alterações de código (diffs) em formato unidiff.
                        Como revisor de código, sua tarefa é:                        
                        Identificar bugs e vulnerabilidades conhecidas,
                        Garantir que o código siga as boas práticas de código limpo,
                        Garantir a aderência aos princípios SOLID,
                        Verificar se os nomes das variáveis são condizentes com o código,
                        Avaliar se as alterações podem impactar negativamente o desempenho do sistema,
                        Sugerir otimizações de desempenho,                        
                        Garantir que as melhores práticas de segurança estejam sendo seguidas,
                        Se todos os tópicos não apresentarem comentários ou não houver código passível de correção, apenas escreva "Sem feedback"
                ${additionalPrompts.length > 0 ? additionalPrompts.map(str => `- ${str}`).join('\n') : null}`;

  try {
    let choices: any;
    let response: any;
    let responseOK: any;

    if (tokenMax === undefined || tokenMax === '') {
      tokenMax = '100';
      console.log(`tokenMax fora dos parametros, para proseguir com a task foi setado para 100.`);
    }
    if (temperature === undefined || temperature === '' || parseInt(temperature) > 2) {
      temperature = '0';
      console.log(`temperature fora dos parametros, para proseguir com a task foi setada para 0.`);
    }

    try {
      const request = await fetch(aoiEndpoint, {
        method: 'POST',
        headers: { 'api-key': `${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_tokens: parseInt(`${tokenMax}`),
          temperature: parseInt(`${temperature}`),
          messages: [{
            role: "user",
            content: `${instructions}\n, patch : ${gitDiff}}`
          }]
        })
      });

      response = await request.json();

      choices = response.choices;
    }
    catch (responseError: any) {
      console.log(`Encontrado erro, validar os parametros de entrada. ${responseError.response.status} ${responseError.response.message}`);
    }

    if (choices && choices.length > 0) {
      const review = choices[0].message?.content as string;

      try { 

        const requestVerificacaoReposta = await fetch(aoiEndpoint, {  
          method: 'POST',  
          headers: {  
              'api-key': `${apiKey}`,  
              'Content-Type': 'application/json'  
          },  
          body: JSON.stringify({  
              max_tokens: parseInt(`${tokenMax}`),  
              temperature: parseInt(`${temperature}`),  
              messages: [  
                  {  
                      role: "system", 
                      content: "Você receberá reposta de um agente de IA que faz code review. Verifique nessa reposta o que é relevante e o que não é relevante na análise do code review. Comentários de afirmação que o código está correto também não são relevantes. Traga na sua reposta apenas os comentários relevantes, caso não haja escreva apenas Sem feedback"  
                  },  
                  {  
                      role: "user", 
                      content: `${review}`  
                  }  
              ]  
          })  
      });
  
          responseOK = await requestVerificacaoReposta.json();           
          

          if (responseOK.choices && responseOK.choices.length > 0) {  
              const reviewOK = responseOK.choices[0].message?.content as string;  
              if (reviewOK.trim() !== "Sem feedback") { 
                  await addCommentToPR(fileName, reviewOK, agent);  
              }  
          }  
      } catch (error) {  
          console.error("Erro ao verificar resposta:", error);  
      }  
    }
    else {
      console.log(`Nao foi possivel gerar revisao para o arquivo ${fileName}`);
    }

    try {              
      const completion_tokens_total = response.usage.completion_tokens + responseOK.usage.completion_tokens;
      const prompt_tokens_total = response.usage.prompt_tokens + responseOK.usage.prompt_tokens;
      const total_tokens_total = response.usage.total_tokens + responseOK.usage.total_tokens;
      
      consumeApi = `Uso: Completions: ${completion_tokens_total}, Prompts: ${prompt_tokens_total}, Total: ${total_tokens_total}`; 
    }
    catch (error: any) {
      console.log(`Erro ao tentar capturar consumo de tokens: ${error.message}`);
    }
    
  }
  catch (error: any) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
}
