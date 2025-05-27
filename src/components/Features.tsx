import React from 'react';
import { Bot, Network, Database, Shield } from 'lucide-react';
const features = [{
  name: 'AI-Powered Development',
  description: 'Leverage advanced AI to write, test, and optimize your data pipelines faster than ever.',
  icon: Bot,
  color: 'text-[#F5B72F]',
  bgColor: 'bg-[#F5B72F]'
}, {
  name: 'Data Lineage',
  description: 'Visualize and track data dependencies across your entire data ecosystem.',
  icon: Network,
  color: 'text-[#2AB7A9]',
  bgColor: 'bg-[#2AB7A9]'
}, {
  name: 'Data Catalog',
  description: 'Centralized repository of all your data assets with rich metadata and documentation.',
  icon: Database,
  color: 'text-purple-500',
  bgColor: 'bg-purple-500'
}, {
  name: 'Data Governance',
  description: 'Enforce data quality standards and maintain compliance across your organization.',
  icon: Shield,
  color: 'text-blue-500',
  bgColor: 'bg-blue-500'
}];
export function Features() {
  return <div className="relative bg-slate-900 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Transform your data development workflow
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Built for modern data teams, our platform provides everything you
            need to develop, monitor, and govern your data infrastructure.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {features.map(feature => <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-lg font-semibold leading-7 text-white">
                  <div className={`rounded-lg ${feature.bgColor}/10 p-2 ring-1 ring-inset ring-${feature.bgColor}/20`}>
                    <feature.icon className={`h-5 w-5 ${feature.color}`} aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-400">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>)}
          </dl>
        </div>
      </div>
    </div>;
}