import React from 'react';
import {
    Building2,
    User,
    Briefcase,
    Phone,
    MapPin,
    Mail,
    Globe,
    Tag,
    ShieldCheck
} from 'lucide-react';

export default function CardFormEditor({ cardData, onChange }) {
    if (!cardData) return null;

    const handleField = (field, val) => {
        onChange(field, val);
    };

    return (
        <div className="space-y-3.5 text-xs">
            {/* Company Name (Dual-Script) */}
            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    <Building2 className="w-3.5 h-3.5 text-zinc-700" />
                    <span>Company / Firm Name</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Original Script (ગુજરાતી / हिंदी)</label>
                        <input
                            type="text"
                            value={cardData.company || ''}
                            onChange={(e) => handleField('company', e.target.value)}
                            placeholder="Company in original script"
                            className="w-full bg-transparent font-gujarati font-bold text-zinc-900 text-sm focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Roman Transliteration / English</label>
                        <input
                            type="text"
                            value={cardData.company_english || ''}
                            onChange={(e) => handleField('company_english', e.target.value)}
                            placeholder="English Company name"
                            className="w-full bg-transparent font-medium text-zinc-800 text-sm focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Person Name & Designation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <User className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Contact Person</span>
                    </div>
                    <input
                        type="text"
                        value={cardData.name || cardData.name_english || ''}
                        onChange={(e) => handleField('name', e.target.value)}
                        placeholder="Person Name"
                        className="w-full bg-transparent font-semibold text-zinc-900 text-sm focus:outline-none"
                    />
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <Briefcase className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Designation / Role</span>
                    </div>
                    <input
                        type="text"
                        value={cardData.designation || ''}
                        onChange={(e) => handleField('designation', e.target.value)}
                        placeholder="e.g. Managing Director, Partner"
                        className="w-full bg-transparent font-medium text-zinc-900 text-sm focus:outline-none"
                    />
                </div>
            </div>

            {/* Phone & Mobile Numbers */}
            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    <Phone className="w-3.5 h-3.5 text-zinc-700" />
                    <span>Phone / Mobile Numbers</span>
                </div>
                <input
                    type="text"
                    value={Array.isArray(cardData.phone) ? cardData.phone.join(', ') : (cardData.phone || '')}
                    onChange={(e) => handleField('phone', e.target.value.split(',').map((s) => s.trim()))}
                    placeholder="e.g. 7600768285"
                    className="w-full bg-transparent font-mono font-bold text-zinc-900 text-sm focus:outline-none"
                />
            </div>

            {/* Postal Address (Dual-Script) */}
            <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    <MapPin className="w-3.5 h-3.5 text-zinc-700" />
                    <span>Full Postal Address</span>
                </div>
                <div className="space-y-2">
                    <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Original Regional Address</label>
                        <textarea
                            rows={2}
                            value={cardData.address || ''}
                            onChange={(e) => handleField('address', e.target.value)}
                            placeholder="Address in original script"
                            className="w-full bg-transparent font-gujarati text-zinc-800 text-xs focus:outline-none resize-none leading-relaxed"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">English Transliteration</label>
                        <textarea
                            rows={2}
                            value={cardData.address_english || ''}
                            onChange={(e) => handleField('address_english', e.target.value)}
                            placeholder="English translated address"
                            className="w-full bg-transparent font-medium text-zinc-800 text-xs focus:outline-none resize-none leading-relaxed"
                        />
                    </div>
                </div>
            </div>

            {/* Email & Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <Mail className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Email Address</span>
                    </div>
                    <input
                        type="email"
                        value={cardData.email || ''}
                        onChange={(e) => handleField('email', e.target.value)}
                        placeholder="contact@company.com"
                        className="w-full bg-transparent font-medium text-zinc-900 text-xs focus:outline-none"
                    />
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <Globe className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Website</span>
                    </div>
                    <input
                        type="text"
                        value={cardData.website || ''}
                        onChange={(e) => handleField('website', e.target.value)}
                        placeholder="www.company.com"
                        className="w-full bg-transparent font-medium text-zinc-900 text-xs focus:outline-none"
                    />
                </div>
            </div>

            {/* Tax / GSTIN & Services */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />
                        <span>GSTIN / Tax ID</span>
                    </div>
                    <input
                        type="text"
                        value={cardData.tax_id || ''}
                        onChange={(e) => handleField('tax_id', e.target.value)}
                        placeholder="e.g. 24AAAAA0000A1Z5"
                        className="w-full bg-transparent font-mono text-zinc-900 text-xs focus:outline-none"
                    />
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50/80 border border-zinc-200/70 focus-within:bg-white focus-within:border-black transition-all">
                    <div className="flex items-center gap-2 mb-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <Tag className="w-3.5 h-3.5 text-zinc-700" />
                        <span>Products / Services Tagline</span>
                    </div>
                    <input
                        type="text"
                        value={cardData.tagline_services || ''}
                        onChange={(e) => handleField('tagline_services', e.target.value)}
                        placeholder="e.g. Ceramic Tiles Manufacturer"
                        className="w-full bg-transparent font-medium text-zinc-900 text-xs focus:outline-none"
                    />
                </div>
            </div>
        </div>
    );
}
