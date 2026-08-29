import { toTextMode } from "./validators";

export function parseTreeNode(data_JSON: TreeNode_JSON): TreeNodeDatum {
  return {
    ...data_JSON,
    text_mode: toTextMode(data_JSON.text_mode),
    children: data_JSON.children?.map(parseTreeNode)
  }
}