My code block has no syntax highlighting.

```
export function emptyIsUndefined(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined
  }

  return text.trim() === '' ? undefined : text
}
```
