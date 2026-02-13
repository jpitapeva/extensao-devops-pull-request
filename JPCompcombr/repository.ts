import * as tl from "azure-pipelines-task-lib/task";
import { SimpleGit, SimpleGitOptions, simpleGit } from "simple-git";
import binaryExtensions from "./binaryExtensions.json";
import  minimatch  from "minimatch";

export class Repository {

    private gitOptions: Partial<SimpleGitOptions> = {
        baseDir: `${tl.getVariable('System.DefaultWorkingDirectory') || process.cwd()}`,
        binary: 'git'
    };

    private readonly _repository: SimpleGit;

    constructor() {
        this._repository = simpleGit(this.gitOptions);
        this._repository.addConfig('core.pager', 'cat');
        this._repository.addConfig('core.quotepath', 'false');
    }

    public async GetChangedFiles(fileExtensions: string | undefined, filesToExclude: string | undefined): Promise<string[]> {
        try {
            await this._repository.fetch();
        } catch (fetchError: any) {
            console.log(`Aviso: Falha ao fazer fetch do repositorio: ${fetchError.message}`);
            console.log('Continuando com branch local...');
        }

        let targetBranch = this.GetTargetBranch();

        let diffs: string;
        try {
            diffs = await this._repository.diff([targetBranch, '--name-only', '--diff-filter=AM']);
        } catch (diffError: any) {
            console.log(`Erro ao executar git diff: ${diffError.message}`);
            return [];
        }
        
        let files = diffs.split('\n').filter(line => line.trim().length > 0);
        
        // Filter out binary files by extension
        let filesToReview = files.filter(file => {
            const lastDotIndex = file.lastIndexOf('.');
            // If no extension, keep the file (e.g., Dockerfile, LICENSE)
            if (lastDotIndex === -1 || lastDotIndex === file.length - 1) {
                return true;
            }
            const ext = file.substring(lastDotIndex + 1);
            return !binaryExtensions.includes(ext);
        });

        if(fileExtensions) {
            let patternsToInclude = fileExtensions.trim().split(',').map(p => p.trim());
            filesToReview = filesToReview.filter(file => patternsToInclude.some(pattern => minimatch(file, pattern)));
        }
    
        if(filesToExclude) {
            let patternsToExclude = filesToExclude.trim().split(',').map(p => p.trim());
            filesToReview = filesToReview.filter(file => !patternsToExclude.some(pattern => minimatch(file, pattern)));
        }


        return filesToReview;
    }

    public async GetDiff(fileName: string): Promise<string> {
        let targetBranch = this.GetTargetBranch();
        
        try {
            let diff = await this._repository.diff([targetBranch, '--', fileName]);
            return diff;
        } catch (diffError: any) {
            console.log(`Erro ao obter diff do arquivo ${fileName}: ${diffError.message}`);
            return '';
        }
    }

    private GetTargetBranch(): string {
        let targetBranchName = tl.getVariable('System.PullRequest.TargetBranchName');

        if (!targetBranchName) {
            targetBranchName = tl.getVariable('System.PullRequest.TargetBranch')?.replace('refs/heads/', '');
        }

        if (!targetBranchName) {
            throw new Error(`Could not find target branch`)
        }

        return `origin/${targetBranchName}`;
    }
}