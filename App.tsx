/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { researchAndGenerateAds } from './services/geminiService';
import AdCard from './components/AdCard';
import Footer from './components/Footer';

export type ImageStatus = 'idle' | 'pending' | 'done' | 'error';

export interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:bg-yellow-600";
const secondaryButtonClasses = "font-permanent-marker text-md text-center text-white bg-white/10 backdrop-blur-sm border border-white/50 py-2 px-6 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black whitespace-nowrap";

const initialFormData = {
    aspectRatio: "1:1 Instagram",
    productType: "",
    productTitle: "",
    flavor: "",
    companyName: "",
    tagline: "",
    brandColors: "",
};

const ImageUpload = ({ label, onImageUpload, uploadedImage }: { label: string, onImageUpload: (dataUrl: string) => void, uploadedImage: string | null }) => {
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                onImageUpload(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div>
            <label className="block font-permanent-marker text-neutral-400 mb-2">{label}</label>
            <label htmlFor={label.toLowerCase().replace(' ', '-')} className="cursor-pointer block bg-white/5 border-2 border-dashed border-white/20 rounded-md aspect-video flex items-center justify-center text-neutral-500 hover:border-yellow-400 hover:text-yellow-400 transition-colors">
                {uploadedImage ? (
                    <img src={uploadedImage} alt="Upload preview" className="max-h-full max-w-full object-contain" />
                ) : (
                    <span>+ Upload</span>
                )}
            </label>
            <input id={label.toLowerCase().replace(' ', '-')} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
        </div>
    );
};

const FormView = ({ onGenerate }: { onGenerate: (productImage: string, logoImage: string | null, formData: typeof initialFormData) => void }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [productImage, setProductImage] = useState<string | null>(null);
    const [logoImage, setLogoImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateClick = () => {
        if (!productImage || !formData.productType || !formData.productTitle) {
            alert("Please provide a product image, type, and title.");
            return;
        }
        setIsGenerating(true);
        onGenerate(productImage, logoImage, formData);
    };

    const isGenerationDisabled = !productImage || !formData.productType || !formData.productTitle || isGenerating;

    return (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 px-4">
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="space-y-6"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ImageUpload label="Product Image" onImageUpload={setProductImage} uploadedImage={productImage} />
                    <ImageUpload label="Company Logo" onImageUpload={setLogoImage} uploadedImage={logoImage} />
                </div>
                <div>
                    <label htmlFor="aspectRatio" className="block font-permanent-marker text-neutral-400 mb-2">Aspect Ratio</label>
                    <select name="aspectRatio" id="aspectRatio" value={formData.aspectRatio} onChange={handleInputChange} className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                        <option>1:1 Instagram</option>
                        <option>16:9 YouTube</option>
                        <option>2:3 Poster</option>
                        <option>9:16 Story</option>
                        <option>4:5 Portrait</option>
                    </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="productType" className="block font-permanent-marker text-neutral-400 mb-2">Product Type*</label>
                        <input type="text" name="productType" id="productType" value={formData.productType} onChange={handleInputChange} placeholder="e.g., cold drink can" className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                        <label htmlFor="productTitle" className="block font-permanent-marker text-neutral-400 mb-2">Product Title*</label>
                        <input type="text" name="productTitle" id="productTitle" value={formData.productTitle} onChange={handleInputChange} placeholder="e.g., SparkFizz" className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="flavor" className="block font-permanent-marker text-neutral-400 mb-2">Flavor</label>
                        <input type="text" name="flavor" id="flavor" value={formData.flavor} onChange={handleInputChange} placeholder="e.g., Lemon Lime" className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                        <label htmlFor="companyName" className="block font-permanent-marker text-neutral-400 mb-2">Company Name</label>
                        <input type="text" name="companyName" id="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="e.g., FizzCo Beverages" className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                </div>
                <div>
                    <label htmlFor="tagline" className="block font-permanent-marker text-neutral-400 mb-2">Tagline (Optional)</label>
                    <input type="text" name="tagline" id="tagline" value={formData.tagline} onChange={handleInputChange} placeholder="e.g., Refresh Your World" className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                    <label htmlFor="brandColors" className="block font-permanent-marker text-neutral-400 mb-2">Brand Colors</label>
                    <input type="text" name="brandColors" id="brandColors" value={formData.brandColors} onChange={handleInputChange} placeholder="e.g., #2AB673, silver, white" className="w-full bg-white/5 border border-white/20 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div className="pt-4">
                    <button onClick={handleGenerateClick} disabled={isGenerationDisabled} className={primaryButtonClasses}>
                        {isGenerating ? 'Generating...' : 'Generate Campaign'}
                    </button>
                </div>
            </motion.div>
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="flex flex-col items-center justify-center text-center text-neutral-500 p-8 bg-white/5 border-2 border-dashed border-white/20 rounded-md"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="font-permanent-marker text-2xl text-neutral-400">Your Campaign Awaits</h3>
                <p className="mt-2 max-w-sm">Fill out the details, upload your product image, and watch as AI generates 10 unique ad concepts for your next big campaign.</p>
            </motion.div>
        </div>
    );
};

const ResultsView = ({ ads, onStartOver }: { ads: GeneratedImage[], onStartOver: () => void }) => (
    <div className="w-full max-w-7xl mx-auto px-4">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center"
        >
            <div className="flex justify-center items-center gap-6 mb-12">
                <button onClick={onStartOver} className={secondaryButtonClasses}>
                    &larr; Start Over
                </button>
                <h2 className="text-3xl md:text-5xl font-permanent-marker text-neutral-100">Your Ad Campaign Concepts</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                {ads.map((ad, index) => (
                    <AdCard
                        key={index}
                        status={ad.status}
                        imageUrl={ad.url}
                        error={ad.error}
                        index={index}
                    />
                ))}
            </div>
        </motion.div>
    </div>
);


function App() {
    const [view, setView] = useState<'form' | 'results'>('form');
    const [generatedAds, setGeneratedAds] = useState<GeneratedImage[]>([]);

    const handleGenerate = (productImage: string, logoImage: string | null, formData: typeof initialFormData) => {
        // Initialize 10 ads in pending state
        setGeneratedAds(Array(10).fill({ status: 'pending' }));
        setView('results');

        // Callback function for real-time updates
        const onProgressUpdate = (index: number, result: GeneratedImage) => {
            setGeneratedAds(prevAds => {
                const newAds = [...prevAds];
                newAds[index] = result;
                return newAds;
            });
        };

        researchAndGenerateAds(productImage, logoImage, formData, onProgressUpdate)
            .catch(err => {
                console.error("Failed to generate ad campaign:", err);
                // If the whole process fails, set all to error
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during campaign generation.";
                setGeneratedAds(Array(10).fill({ status: 'error', error: errorMessage }));
            });
    };
    
    const handleStartOver = () => {
        setGeneratedAds([]);
        setView('form');
    };

    return (
        <main className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-24 relative">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>

            <div className="z-10 flex flex-col items-center justify-center w-full h-full flex-1">
                <AnimatePresence mode="wait">
                    {view === 'form' ? (
                        <motion.div
                            key="form"
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full flex flex-col items-center"
                        >
                            <div className="text-center mb-10">
                                <h1 className="text-6xl md:text-8xl font-caveat font-bold text-neutral-100">AdMagic</h1>
                                <p className="font-permanent-marker text-neutral-300 mt-2 text-xl tracking-wide">Generate professional ad campaigns in seconds.</p>
                            </div>
                            <FormView onGenerate={handleGenerate} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                             className="w-full flex flex-col items-center"
                        >
                           <ResultsView ads={generatedAds} onStartOver={handleStartOver} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <Footer />
        </main>
    );
}

export default App;
