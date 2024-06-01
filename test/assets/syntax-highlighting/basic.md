The highlight of my day:

```ts
export type YankiNote = Simplify<
  {
    cards?: number[]
    fields: { Back: string; Front: string; YankiNamespace: string }
    modelName: YankiModelName
    noteId: number | undefined
  } & Omit<YankiParamsForAction<'addNote'>['note'], 'fields' | 'modelName' | 'options'>
>
```

---

How about a bit more!

```ts
export function deleteFirstNodeOfType(tree: Root, nodeType: string): Root {
  visit(tree, nodeType, (_, index, parent) => {
    if (parent && index !== undefined) {
      parent.children.splice(index, 1)
      return EXIT
    }
  })

  return tree
}
```
