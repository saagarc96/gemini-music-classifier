import { useState } from 'react';
import { Music, Mail, Lock, ArrowRight } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login delay
    setTimeout(() => {
      onLogin();
    }, 800);
  };

  const handleDemoLogin = () => {
    setEmail('curator@rainamusic.com');
    setPassword('demo123');
    setIsLoading(true);
    
    setTimeout(() => {
      onLogin();
    }, 800);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 flex-col justify-between">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-white text-2xl">Raina Music</h1>
              <p className="text-white/80 text-sm">Classification Review System</p>
            </div>
          </div>

          <div className="space-y-6 mt-16">
            <h2 className="text-white text-4xl leading-tight">
              Streamline your<br />
              music curation<br />
              workflow
            </h2>
            <p className="text-white/90 text-lg max-w-md">
              Review and refine AI-generated music classifications with precision and speed.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3 text-white/90">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">20,000+ Songs</p>
              <p className="text-sm text-white/70">Across 120 playlists</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ArrowRight className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">AI-Powered</p>
              <p className="text-sm text-white/70">Gemini batch processing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-12">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-zinc-100 text-2xl">Raina Music</h1>
              <p className="text-zinc-400 text-sm">Classification Review</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-zinc-100 text-3xl">Welcome back</h2>
            <p className="text-zinc-400">Sign in to continue to your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="curator@rainamusic.com"
                  required
                  className="pl-11 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                <button
                  type="button"
                  className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-11 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-12"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-zinc-950 text-zinc-500">or</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              variant="outline"
              className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 h-12"
            >
              Try Demo Account
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <button className="text-blue-500 hover:text-blue-400 transition-colors">
              Contact Admin
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
