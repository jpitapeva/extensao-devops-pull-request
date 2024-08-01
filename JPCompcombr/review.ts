import fetch from 'node-fetch';
import { git } from './git';
import { addCommentToPR } from './pr';
import * as https from 'https';
import * as http from 'http';


export let consumeApi : string;
export async function reviewFile(gitDiff: string, fileName: string, agent: http.Agent | https.Agent, apiKey: string, aoiEndpoint: string, tokenMax: string | undefined, temperature: string | undefined, additionalPrompts: string[] = []) {
  console.log(`Iniciando revisao do arquivo: ${fileName} ...`);

  const instructions = `Você é um assistente do ramo de desenvolvimento de software.
                        Sua missão é atuar como um revisor de código de um Pull Reques,  fornecendo feedback sobre possíveis bugs e boas práticas de código limpo, sendo didático e fazendo o uso de linguagem técnica.
                        Você recebe as alterações do Pull Request em formato de patch, cada entrada de patch tem a mensagem de commit na linha de Assunto seguida pelas alterações de código (diffs) em formato unidiff.
                        Como revisor de código, sua tarefa é:
                        - Revisar apenas linhas adicionadas, editadas ou excluídas.
                        - Se não houver bugs e as alterações estiverem corretas, escreva apenas a frase 'Sem Feedback.'
                        - Se houver bug ou alterações de código incorretas, não escreva apenas a frase 'Sem Feedback.'
                        -Forneça apenas instruções de melhoria.
                ${additionalPrompts.length > 0 ? additionalPrompts.map(str => `- ${str}`).join('\n') : null}`;

  try {
    let choices: any;
    let response: any;
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

      if (review.trim() !== "Sem feedback.") {
        await addCommentToPR(fileName, review, agent);
      }
    }

    console.log(`Revisao ${fileName} completa.`);
    consumeApi = `Uso: Completions: ${response.usage.completion_tokens}, Prompts: ${response.usage.prompt_tokens}, Total: ${response.usage.total_tokens}`; 
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