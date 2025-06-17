import React from 'react';
import { Zap, Clock, Gauge, Shield } from 'lucide-react';
const benefits = [{
  name: 'Faster Development',
  description: 'Reduce development time by up to 80% with AI-powered code generation and testing.',
  icon: Zap
}, {
  name: 'Real-time Monitoring',
  description: 'Monitor your data pipelines in real-time and catch issues before they impact your business.',
  icon: Clock
}, {
  name: 'Enhanced Performance',
  description: 'Optimize your queries and pipelines for better performance and reduced costs.',
  icon: Gauge
}, {
  name: 'Built-in Governance',
  description: 'Ensure data quality and compliance with built-in governance features.',
  icon: Shield
}];
export function Benefits() {
  return <div className="relative bg-slate-900 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Benefits for Your Data Team
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Empower your data team with tools that make development faster,
            safer, and more reliable.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {benefits.map(benefit => <div key={benefit.name} className="flex flex-col items-start bg-slate-800/50 rounded-lg p-6 hover:bg-slate-800 transition-colors duration-200">
                <div className="rounded-lg bg-[#2AB7A9]/10 p-2 ring-1 ring-inset ring-[#2AB7A9]/20">
                  <benefit.icon className="h-6 w-6 text-[#2AB7A9]" aria-hidden="true" />
                </div>
                <dt className="mt-4 font-semibold text-white">
                  {benefit.name}
                </dt>
                <dd className="mt-2 leading-7 text-slate-400">
                  {benefit.description}
                </dd>
              </div>)}
          </dl>
        </div>
      </div>
    </div>;
}