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

### Permitir que a tarefa acesse o token do sistema
Adicione uma seção de checkout com persistCredentials definido como true.

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

  - task: JPCompcombr@21
    displayName: GPTPullRequestReview
    inputs:
      api_key: 'YOUR_TOKEN'
      model: 'gpt-4'
      aoi_endpoint: 'https://{XXXXXXXX}.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}'
      aoi_tokenMax: 1000
      aoi_temperature: 0
      file_extensions: 'js,ts,css,html'
      file_excludes: 'file1.js,file2.py,secret.txt'
      additional_prompts: 'Prompt separado por virula, exemplo: corrija a nomenclatura de variaveis, garanta identacao consistente, revise a abordagem de tratamento de erros'
```

## License
[MIT](https://raw.githubusercontent.com/mlarhrouch/azure-pipeline-gpt-pr-review/main/LICENSE)

## Developer plugin Steps</br>
Into folder project, run command:  ```npm run build``` </br>
Bump version in vss-extension.json and task.json</br>
Run command for generate new package: ```npx tfx-cli extension create```</br>
Upload extension to marketplace: https://marketplace.visualstudio.com/manage/a</br>
Author: Joao Paulo Moreira Antunes (jpitapeva@hotmail.com)</br>

