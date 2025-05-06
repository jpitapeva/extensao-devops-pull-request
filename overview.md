# Use o modelo OpenAI GPT para revisar solicitações pull para Azure Devops
Task do Azure DevOps que adiciona comentários em portugues nas solicitacoes de PullRequest com a ajuda do GPT.

## Instalação
A instalação pode ser feita usando o [Visual Studio MarketPlace](https://marketplace.visualstudio.com/publishers/jpcompcombr).

## Serviço Azure Open AI
A formatação do endpoint é a seguinte: https://{XXXXXXXX}.openai.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}

[Documentação API REST](https://learn.microsoft.com/pt-br/azure/ai-services/openai/reference).

### Dê permissão ao agente de serviço de build
Antes de usar esta task, certifique-se de que o serviço de build tenha permissoes para contribuir em seu REPOSITORIO:

![contribute_to_pr](https://github.com/jpitapeva/extensao-devops-pull-request/blob/main/images/contribute_to_pr.png?raw=true)

### Permitir que a tarefa acesse o token do sistema
Adicione uma secao de checkout com persistCredentials definido como true.

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

  - task: JPCompcombr@25
    displayName: GPTPullRequestReview
    inputs:
      api_key: 'YOUR_TOKEN'
      model: 'gpt-4'
      aoi_endpoint: 'https://{XXXXXXXX}.azure.com/openai/deployments/{MODEL_NAME}/chat/completions?api-version={API_VERSION}'
      aoi_tokenMax: 1000
      aoi_temperature: 0
      use_https: true
      prompt: 'Opcional. Agora se desejar voce pode criar o seu proprio prompt, exemplo. Atue como revisor de código de uma solicitação de pull, fornecendo feedback sobre possíveis bugs e problemas de código limpo.\nVocê recebe as alterações da solicitação de pull em um formato de patch.\nCada entrada de patch tem a mensagem de confirmação na linha de assunto, seguida pelas alterações de código (diffs) em um formato unidiff.\n\nComo revisor de código, sua tarefa é:\n- Revisar apenas as linhas adicionadas, editadas ou excluídas.\n- Se não houver bugs e as alterações estiverem corretas, escreva apenas 'Sem feedback'.\n- Se houver bugs ou alterações de código incorretas, não escreva 'Sem feedback'.'
      file_excludes: 'file1.js,file2.py,secret.txt,*.csproj,src/**/*.csproj'
      additional_prompts: 'Opcional. Prompt adicional separado por virula, exemplo: corrija a nomenclatura de variaveis, garanta identacao consistente, revise a abordagem de tratamento de erros'
```

## License
[MIT](https://raw.githubusercontent.com/mlarhrouch/azure-pipeline-gpt-pr-review/main/LICENSE)

## Plus
[Devops Publish](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops)
