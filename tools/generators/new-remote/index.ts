import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
  readJson,
  updateJson,
} from '@nx/devkit';
import * as path from 'path';

interface NewRemoteSchema {
  name: string;
  port: number;
}

export default async function (tree: Tree, schema: NewRemoteSchema) {
  const projectRoot = `apps/remotes/${schema.name}`;
  const starterRoot = 'apps/remotes/_starter';

  // 1. starter 템플릿 파일들을 복사하여 새로운 프로젝트 생성
  generateFiles(
    tree,
    path.join(__dirname, '../../../apps/remotes/_starter'), // 실제 starter 폴더를 소스로 사용
    projectRoot,
    {
      name: schema.name,
      port: schema.port,
      template: '', // 템플릿 문법을 사용하지 않고 직접 복사할 경우 빈값
    }
  );

  // 2. project.json 내용 수정
  updateJson(tree, `${projectRoot}/project.json`, (json) => {
    json.name = schema.name;
    json.sourceRoot = `${projectRoot}/src`;
    json.targets.build.options.outputPath = `dist/apps/remotes/${schema.name}`;
    json.targets.serve.options.port = Number(schema.port);
    json.targets.serve.options.buildTarget = `${schema.name}:build`;
    return json;
  });

  // 3. vite.config.ts의 포트 번호 수정 (직접 파일 쓰기)
  const viteConfigPath = `${projectRoot}/vite.config.ts`;
  let viteConfigContent = tree.read(viteConfigPath, 'utf-8') || '';
  viteConfigContent = viteConfigContent.replace('port: 4299', `port: ${schema.port}`);
  tree.write(viteConfigPath, viteConfigContent);

  // 4. package.json에 편리한 스크립트 추가
  updateJson(tree, 'package.json', (json) => {
    json.scripts[`dev:${schema.name}`] = `vite --config ${projectRoot}/vite.config.ts`;
    json.scripts[`build:${schema.name}`] = `tsc && vite build --mode prod --config ${projectRoot}/vite.config.ts`;
    return json;
  });

  await formatFiles(tree);

  console.log(`\n✅ Remote App '${schema.name}'이(가) 성공적으로 생성되었습니다!`);
  console.log(`🚀 실행: npm run dev:${schema.name} (Port: ${schema.port})`);
}
