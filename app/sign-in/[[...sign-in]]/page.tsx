import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">2026 Training</h1>
        <p className="text-sm text-gray-500 mt-1">Lou Fox · Marathon</p>
      </div>
      <SignIn />
    </div>
  )
}
