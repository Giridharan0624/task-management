import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Task Management</h1>
          <p className="mt-2 text-gray-500">Create your account</p>
        </div>
        <div className="rounded-2xl bg-white px-8 py-8 shadow-lg border border-gray-100">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
