
interface BlogHeaderProps {
    title: string;
    description: string;
}

export function BlogHeader({ title, description }: BlogHeaderProps) {
    return (
        <div className="text-center py-8 sm:py-12">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">{title}</h1>
            <p className="text-sm text-gray-400 max-w-lg mx-auto">{description}</p>
        </div>
    )
}
