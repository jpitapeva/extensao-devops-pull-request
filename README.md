# Use o modelo OpenAI GPT para revisar solicitações pull para Azure Devops
Task do Azure DevOps que adiciona comentários em portugues nas solicitações de PullRequest com a ajuda do ChatGPT.

## Instalação
A instalação da task pode ser feita usando o [Visual Studio MarketPlace](https://marketplace.visualstudio.com/publishers/jpcompcombr).

## Serviço Azure Open AI
A formatação do endpoint é a seguinte: https://{XXXXXXXX}.openai.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}

[Documentação API REST](https://learn.microsoft.com/pt-br/azure/ai-services/openai/reference).

### Dê permissão ao agente de serviço de build
Antes de usar esta task, certifique-se de que o serviço de build tenha permissões para contribuir em seu REPOSITORIO:

![contribute_to_pr](https://github.com/jpitapeva/extensao-devops-pull-request/blob/main/images/contribute_to_pr.png?raw=true)

### Encontrar o Agente de Serviço de Build
1. Acesse o Azure DevOps
1. Va até Project Settings
1. Abra Permissions
1. Procure por:
\<ProjectName\> Build Service (\<OrganizationName\>)

Este é o identity usado pelos pipelines YAML e Classic.

### Permitir que a tarefa acesse o token do sistema
Adicione uma seção de checkout com persistCredentials definido como true.

### Release notes
- Na versão 27.0.2 corrigimos vulnerabilidades em bibliotecas de terceiros e atualizamos o Node.js de 16 para 20_1. Atenção: essa mudança pode exigir ajustes em ambientes que ainda usam Node.js 16.
- Na versão 28 adicionamos um campo opcional chamado(build_service_name) detalhes:(O build_service_name é um campo opcional e deve ser informado quando existir um build service específico configurado dentro do repositório do Azure Devops).
- Na versão 29 foi corrigido as novas especificações da API do OpenAI que mudaram o parâmetro do body de `max_tokens` para `max_completion_tokens` e o valor default de temperature de `0` para `1`.


#### Pipelines Yaml
```yaml
jobs:
- job:
  displayName: "JPCompcombr code review"
  pool:
    vmImage: ubuntu-latest 
 
  steps:
  - checkout: self
    persistCredentials: true

  - task: JPCompcombr@29
    displayName: GPTPullRequestReview
    inputs:
      api_key: 'YOUR_TOKEN'
      aoi_endpoint: 'https://{XXXXXXXX}.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}'
      aoi_tokenMax: 1000
      aoi_temperature: 1
      use_https: true
      prompt: 'Opcional. Se desejar agora voce pode criar o seu proprio prompt, exemplo. Atue como revisor de código de uma solicitação de pull, fornecendo feedback sobre possíveis bugs e problemas de código limpo.\nVocê recebe as alterações da solicitação de pull em um formato de patch.\nCada entrada de patch tem a mensagem de confirmação na linha de assunto, seguida pelas alterações de código (diffs) em um formato unidiff.\n\nComo revisor de código, sua tarefa é:\n- Revisar apenas as linhas adicionadas, editadas ou excluídas.\n- Se não houver bugs e as alterações estiverem corretas, escreva apenas 'Sem feedback'.\n- Se houver bugs ou alterações de código incorretas, não escreva 'Sem feedback'.'
      file_excludes: 'file1.js,file2.py,secret.txt,*.csproj,src/**/*.csproj'
      additional_prompts: 'Opcional. Prompt adicional separado por virgula, exemplo: corrija a nomenclatura de variaveis, garanta identacao consistente, revise a abordagem de tratamento de erros'
      build_service_name: 'Opcional. O build_service_name é um campo opcional e deve ser informado quando existir um build service específico configurado dentro do repositório do Azure Devops.'
```

## License
[MIT](https://raw.githubusercontent.com/mlarhrouch/azure-pipeline-gpt-pr-review/main/LICENSE)

## Developer plugin Steps</br>
Into folder project, run command:  ```npm run build``` </br>
Bump version in vss-extension.json and task.json</br>
Run command for generate new package: ```npx tfx-cli extension create```</br>
Upload extension to marketplace: https://marketplace.visualstudio.com/manage</br>

## GPT (transformador pré-treinado gerativo)

## O que é a engenharia de prompts
Os modelos de IA generativa são treinados em grandes quantidades de dados e podem gerar texto, imagens, código e conteúdo criativo com base na continuação mais provável do prompt.

Engenharia de prompt é o processo de criação e otimização de prompts para utilizar melhor os modelos de IA. A criação de prompts eficazes é fundamental para o sucesso da engenharia de prompt e pode aprimorar significativamente o desempenho do modelo de IA em tarefas específicas. Fornecer prompts relevantes, específicos, inequívocos e bem estruturados pode ajudar o modelo a entender melhor o contexto e gerar respostas mais precisas.

Por exemplo, se quisermos que um modelo de OpenAI gere descrições de produto, poderemos fornecer uma descrição detalhada que descreve os recursos e os benefícios do produto. Quando esse contexto é fornecido, o modelo pode gerar descrições de produto mais precisas e relevantes.

A engenharia de prompt também pode ajudar a reduzir o viés e a aumentar a imparcialidade em modelos de IA. Ao criar prompts diversos e inclusivos, podemos garantir que o modelo não seja tendencioso em relação a um determinado grupo ou perspectiva.

## Curl
```
curl https://YOUR_ENDPOINT_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2023-03-15-preview \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{"messages":[{"role": "system", "content": "You are a helpful assistant, teaching people about AI."},
{"role": "user", "content": "Does Azure OpenAI support multiple languages?"},
{"role": "assistant", "content": "Yes, Azure OpenAI supports several languages, and can translate between them."},
{"role": "user", "content": "Do other Azure AI Services support translation too?"}]}'
```


### Author: Joao Paulo Moreira Antunes (https://www.jpcomp.com.br/)</br>

