import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ToolOption, InputResult } from '../bridge.js'

interface OptionSelectProps {
  options: ToolOption[]
  onSelect: (result: InputResult) => void
}

export function OptionSelect({ options, onSelect }: OptionSelectProps) {
  const [cursor, setCursor] = useState(0)
  const [textValue, setTextValue] = useState('')

  // Items: options + free-text field at the bottom
  const totalItems = options.length + 1
  const isOnTextField = cursor === options.length

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1))
      return
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(totalItems - 1, c + 1))
      return
    }
    if (key.return) {
      if (isOnTextField) {
        if (textValue.trim()) {
          onSelect({ kind: 'text', value: textValue.trim() })
        }
      } else {
        onSelect({ kind: 'select', value: options[cursor].label })
      }
      return
    }

    // When on the text field, handle typing
    if (isOnTextField) {
      if (key.backspace || key.delete) {
        setTextValue((v) => v.slice(0, -1))
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setTextValue((v) => v + input)
      }
    }
  })

  let hasRecommended = false

  return (
    <Box flexDirection="column" paddingX={1}>
      {options.map((opt, i) => {
        const isHighlighted = cursor === i
        const pointer = isHighlighted ? '❯ ' : '  '

        let label = opt.label
        if (opt.recommended && !hasRecommended) {
          label += ' (Recommended)'
          hasRecommended = true
        }

        return (
          <Box key={opt.label}>
            <Text color={isHighlighted ? 'cyan' : undefined}>
              {pointer}{label}
            </Text>
            {opt.description && (
              <Text dimColor> — {opt.description}</Text>
            )}
          </Box>
        )
      })}

      {/* Free-text field as the last item */}
      <Box marginTop={1}>
        <Text color={isOnTextField ? 'cyan' : undefined}>
          {isOnTextField ? '❯ ' : '  '}
        </Text>
        {isOnTextField ? (
          <Text>
            <Text color="cyan">{textValue}</Text>
            <Text color="cyan">▊</Text>
            {!textValue && <Text dimColor> Type a question or suggestion...</Text>}
          </Text>
        ) : (
          <Text dimColor>Type a question or suggestion...</Text>
        )}
      </Box>
    </Box>
  )
}
