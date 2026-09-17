/** Clipboard formats for a link to a node in the current map. */
export function nodeLinkClipboard(node) {
  if (!node || typeof node.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(node.id) || typeof node.title !== 'string' || node.title.length > 160) throw new Error('Invalid node link.');
  const title = node.title.replace(/[\r\n]+/g, ' ').trim() || 'Untitled idea';
  const href = `node://${node.id}`;
  const htmlTitle = title.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const markdownTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|~-]/g, '\\$&');
  return { text: `[${markdownTitle}](${href})`, html: `<a href="${href}">${htmlTitle}</a>` };
}

export const isNodeLinkMarkdown = text => /^\[(?:\\.|[^\r\n])*\]\(node:\/\/[a-zA-Z0-9_-]{1,100}\)$/.test(text.trim());
