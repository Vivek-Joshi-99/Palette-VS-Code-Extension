import * as k8s from 'vscode-kubernetes-tools-api';
import * as shelljs from 'shelljs';
import { ChildProcess } from 'child_process';

const KIND_CLUSTER_PROVIDER_ID = 'palette';

export const KIND_CLUSTER_PROVIDER: k8s.ClusterProviderV1.ClusterProvider = {
    id: KIND_CLUSTER_PROVIDER_ID,
    displayName: 'Palette Virtual Cluster',
    supportedActions: ['create'],
    next: onNext
};

const PAGE_SETTINGS = 'settings';
const PALETTE_SETTINGS = 'login';

const SETTING_CLUSTER_NAME = 'clusterName';
const SETTING_CLUSTER_CPU = 'clusterCPU';
const SETTING_CLUSTER_MEMORY = 'clusterMemory';
const SETTING_CLUSTER_STORAGE = 'clusterStorage';
const SETTING_CLUSTER_GROUP = 'clusterGroup';
const SETTING_PALETTE_API = 'paletteAPI';
const SETTING_PALETTE_URL = 'paletteURL';

function onNext(wizard: k8s.ClusterProviderV1.Wizard, _action: k8s.ClusterProviderV1.ClusterProviderAction, message: any): any {
    console.log("Here");
    wizard.showPage("<h1>Please wait...</h1>");
    const sendingStep: string = message[k8s.ClusterProviderV1.SENDING_STEP_KEY];
    const htmlPromise: any = getPage(sendingStep, message);
    console.log(htmlPromise);
    if (sendingStep === "login") {
        wizard.showPage("<h1>TEST</h1>");
    }else {
        wizard.showPage(htmlPromise);
    }
}

function getPage(sendingStep: string, previousData: any): k8s.ClusterProviderV1.Sequence<string> {
    switch (sendingStep) {
        case k8s.ClusterProviderV1.SELECT_CLUSTER_TYPE_STEP_ID:
            return collectCredentails(previousData);
        case PALETTE_SETTINGS:
            return "<h1>TEST</h1>"; // collectSettings(previousData);
        case PAGE_SETTINGS:
            return createCluster(previousData);
        default:
            return "Internal error";
    }
}

function collectCredentails(previousData: any): string {
    const inputCreds = [
        `<p>Palette API Key: <input type='text' name='${SETTING_PALETTE_API}' value='' /></p>`,
        `<p>Login URL: <input type='text' name='${SETTING_PALETTE_URL}' value='' /></p>`
    ];
    const html = formPage(
        PALETTE_SETTINGS,
        "Palette Settings",
        inputCreds.join('\n'),
        "Create",
        previousData);
    return html;
}

function collectSettings(previousData: any): string {
    const inputSettings = [
        `<p>Virtual cluster name: <input type='text' name='${SETTING_CLUSTER_NAME}' /></p>`,
        `<p>Cluster CPU: <input type='number' name='${SETTING_CLUSTER_CPU}' /></p>`,
        `<p>Cluster Memory: <input type='number' name='${SETTING_CLUSTER_MEMORY}' /></p>`,
        `<p>Cluster Storage: <input type='number' name='${SETTING_CLUSTER_STORAGE}' /></p>`,
        `<p>Cluster Group (Default Beehive): <input type='text' name='${SETTING_CLUSTER_GROUP}' /></p>`
    ];
    const html = formPage(
        PAGE_SETTINGS,
        "Cluster Settings",
        inputSettings.join('\n'),
        "Next",
        previousData);
    return html;
}

function createCluster(previousData: any): k8s.ClusterProviderV1.Observable<string> {
    console.log('inside create cluster');
    return {
        subscribe(observer: k8s.ClusterProviderV1.Observer<string>): void {
            observer.onNext("<h1>Creating Paltte Virtual cluster - please wait</h1>");
            let stdout = '';
            let stderr = '';
            let resultPara = '';
            let title = 'Creating Palette Virtual cluster - please wait';
            function html() {
                return `<h1>${title}</h1>${paragraphise(stdout)}${paragraphise(stderr, 'red')}${resultPara}`;
            }
            const clusterName: string = previousData[SETTING_CLUSTER_NAME];
            const clusterCPU: string = previousData[SETTING_CLUSTER_CPU];
            const clusterMemory: string = previousData[SETTING_CLUSTER_MEMORY];
            const clusterStorage: string = previousData[SETTING_CLUSTER_STORAGE];
            const clusterGroup: string = previousData[SETTING_CLUSTER_GROUP];
            const childProcess = shelljs.exec(`palette pde virtual-cluster create --cluster-group-name ${clusterGroup} --cluster-group-scope system --cpu ${clusterCPU} --memory ${clusterMemory} --name ${clusterName} --storage ${clusterStorage}`, { async: true }) as ChildProcess;
            childProcess.stdout.on('data', (chunk: string) => {
                stdout += chunk;
                observer.onNext(html());
            });
            childProcess.stderr.on('data', (chunk: string) => {
                stderr += chunk;
                observer.onNext(html());
            });
            childProcess.on('error', (err: Error) => {
                stderr += err.message;
                observer.onNext(html());
            });
            childProcess.on('exit', (code: number) => {
                if (code === 0) {
                    title = 'Cluster created';
                    resultPara = `<p style='font-weight: bold; color: lightgreen'>Your palette virtual cluster has been created BUT HAS NOT BEEN set as active in your kubeconfig</p>`;
                    observer.onNext(html());
                    shelljs.exec(`palette pde virtual-cluster download-kubeconfig --name ${clusterName}`, { async: true }, (code, pStdout, _pStderr) => {
                        if (code === 0) {
                            const kcpath = pStdout.trim();
                            resultPara = `<p style='font-weight: bold; color: lightgreen'>Your local cluster has been created and its kubeconfig is at ${kcpath}. To work with your cluster, switch to this kubeconfig, or copy settings from this file to your main kubeconfig.</p>`;
                            observer.onNext(html());
                        }
                    });
                } else {
                    title = 'Cluster creation failed';
                    resultPara = `<p style='font-weight: bold; color: red'>Your local cluster was not created.  See tool output above for why.</p>`;
                    observer.onNext(html());
                }
            });
        }
    };
}

function formPage(stepId: string, title: string, body: string, buttonCaption: string | null, previousData: any): string {
    const buttonHtml = buttonCaption ? `<button onclick='${k8s.ClusterProviderV1.NEXT_PAGE}'>${buttonCaption} &gt;</button>` : '';
    const previousDataFields = Object.keys(previousData)
                                     .filter((k) => k !== k8s.ClusterProviderV1.SENDING_STEP_KEY)
                                     .map((k) => `<input type='hidden' name='${k}' value='${previousData[k]}' />`)
                                     .join('\n');
    const html = `<h1>${title}</h1>
    <form id="${k8s.ClusterProviderV1.WIZARD_FORM_NAME}">
        <input type='hidden' name='${k8s.ClusterProviderV1.SENDING_STEP_KEY}' value='${stepId}' />
        <input type='hidden' name='${k8s.ClusterProviderV1.CLUSTER_TYPE_KEY}' value='${KIND_CLUSTER_PROVIDER_ID}' />
        ${previousDataFields}
        ${body}
        <p>${buttonHtml}</p>
    </form>
    `;

    return html;
}

function paragraphise(text: string, colour?: string): string {
    const colourAttr = colour ? ` style='color:${colour}'` : '';
    const lines = text.split('\n').map((l) => l.trim());
    const paras = lines.map((l) => `<p${colourAttr}>${l}</p>`);
    return paras.join('\n');
}