'use client'

import { useForm } from 'react-hook-form'
import { useCreateProject } from '@/lib/hooks/useProjects'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

interface FormValues {
  name: string
  description: string
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const createProject = useCreateProject()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>()

  const onSubmit = async (values: FormValues) => {
    await createProject.mutateAsync({
      name: values.name,
      description: values.description || undefined,
    })
    reset()
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Project">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Project Name"
          placeholder="e.g. Product Roadmap"
          error={errors.name?.message}
          {...register('name', {
            required: 'Project name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
            maxLength: { value: 100, message: 'Name must be at most 100 characters' },
          })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Description (optional)</label>
          <textarea
            rows={3}
            placeholder="What is this project about?"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            {...register('description')}
          />
        </div>

        {createProject.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {createProject.error instanceof Error
              ? createProject.error.message
              : 'Failed to create project'}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
