/** @type {import('eslint').Rule.RuleModule} */
export const linguiTMacroOutsideJsx = {
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      tMacroOutsideJsxContext: 'Used t macro outside of JSX context',
    },
  },
  create(context) {
    let hasLinguiCoreMacroImport = false;
    let hasDefineMessageImport = false;
    let linguiImportNode = null;

    return {
      ImportDeclaration(node) {
        if (node.source.value === '@lingui/core/macro') {
          hasLinguiCoreMacroImport = true;
          linguiImportNode = node;
          for (const specifier of node.specifiers) {
            if (specifier.imported && specifier.imported.name === 'defineMessage') {
              hasDefineMessageImport = true;
            }
          }
        }
      },
      'CallExpression > Identifier[name="t"]'(identifierNode) {
        // If we don't find a JSX element, this usage of the t macro is suspect.
        let parent = identifierNode.parent;
        while (parent) {
          if (parent.type.startsWith('JSX')) {
            return;
          }
          parent = parent.parent;
        }

        context.report({
          node: identifierNode,
          messageId: 'tMacroOutsideJsxContext',
          fix(fixer) {
            const fixes = [fixer.replaceText(identifierNode, 'defineMessage')];

            if (hasLinguiCoreMacroImport && !hasDefineMessageImport) {
              fixes.push(
                fixer.insertTextAfter(
                  linguiImportNode.specifiers[linguiImportNode.specifiers.length - 1],
                  ', defineMessage',
                ),
              );
            } else if (!hasLinguiCoreMacroImport) {
              fixes.push(
                fixer.insertTextBefore(
                  context.getSourceCode().ast.body[0],
                  "import { defineMessage } from '@lingui/core/macro';\n",
                ),
              );
            }

            return fixes;
          },
        });
      },
    };
  },
};
