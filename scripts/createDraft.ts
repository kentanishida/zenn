import * as fs from 'fs';
import * as path from 'path';

interface DraftOptions {
  title: string;
  aim: string;
  contents: string;
}

function createDraft({ title, aim, contents }: DraftOptions): void {
  const templatePath = path.join(__dirname, 'template.md');
  const template = fs.readFileSync(templatePath, 'utf-8');
  
  const today = new Date();
  const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const draftContent = template
    .replace('# タイトル', `# ${title}`)
    .replace('## 狙い', `## 狙い\n\n${aim}`)
    .replace('## 概要', `## 概要\n\n${contents}`);
  
  const draftDir = path.join(__dirname, '..', 'draft');
  if (!fs.existsSync(draftDir)) {
    fs.mkdirSync(draftDir, { recursive: true });
  }
  
  const filename = `${dateString}_${title}.draft.md`;
  const draftPath = path.join(draftDir, filename);
  
  fs.writeFileSync(draftPath, draftContent, 'utf-8');
  
  console.log(`Draft created: ${draftPath}`);
}

export { createDraft, DraftOptions };