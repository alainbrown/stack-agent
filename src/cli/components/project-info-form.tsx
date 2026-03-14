import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { TextInput } from '@inkjs/ui'

interface ProjectInfoFormProps {
  onSubmit: (name: string, description: string) => void
}

export function ProjectInfoForm({ onSubmit }: ProjectInfoFormProps) {
  const [field, setField] = useState<'name' | 'description'>('name')
  const [name, setName] = useState('')

  return (
    <Box flexDirection="column">
      <Text bold>Let's set up your project</Text>
      <Text> </Text>

      {field === 'name' && (
        <Box>
          <Text color="cyan">Project name: </Text>
          <TextInput
            placeholder="my-app"
            onSubmit={(value) => {
              if (value.trim()) {
                setName(value.trim())
                setField('description')
              }
            }}
          />
        </Box>
      )}

      {field === 'description' && (
        <Box flexDirection="column">
          <Box>
            <Text color="green">✓ Project name: </Text>
            <Text>{name}</Text>
          </Box>
          <Box>
            <Text color="cyan">What are you building: </Text>
            <TextInput
              placeholder="a task management SaaS"
              onSubmit={(value) => {
                if (value.trim()) {
                  onSubmit(name, value.trim())
                }
              }}
            />
          </Box>
        </Box>
      )}

      <Text> </Text>
      <Text dimColor>
        {field === 'name'
          ? 'Enter a name for your project'
          : 'Briefly describe what you\'re building'}
      </Text>
    </Box>
  )
}
