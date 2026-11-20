import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import 'monaco-editor/languages/definitions/cpp/register';
import 'monaco-editor/languages/definitions/python/register';
import 'monaco-editor/languages/definitions/rust/register';
import { registerFormatters } from '../lib/formatters';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
registerFormatters(monaco);
export default Editor;
