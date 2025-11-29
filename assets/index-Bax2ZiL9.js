(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))l(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&l(s)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function l(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();function p(e,t=2){const n=parseFloat(e);return isNaN(n)?"-":(n/1e4).toLocaleString("zh-CN",{minimumFractionDigits:t,maximumFractionDigits:t})}function T(e,t=2){const n=parseFloat(e);return isNaN(n)?"-":n.toLocaleString("zh-CN",{minimumFractionDigits:t,maximumFractionDigits:t})}function P(e,t=1){const n=parseFloat(e);return isNaN(n)?"-":(n*100).toFixed(t)+"%"}function Y(e,t,n,l,a){if(!t||!n)return{error:"请输入有效的燃料消耗量和热值"};const o=t*n/1e3;let s=0;if(l==="water"){const{mass:c,tempIn:i,tempOut:d}=a;if(!c||i===void 0||!d)return{error:"请输入完整的热水参数"};const m=d-i;s=4.186*c*m/1e3}else if(l==="steam"){const{mass:c,pressure:i,feedTemp:d}=a;if(!c||!i||d===void 0)return{error:"请输入完整的蒸汽参数"};const m=2770,w=4.186*d;s=c*(m-w)/1e6}return o<=0?{error:"计算得出的投入能量无效"}:{efficiency:s/o*100,inputEnergy:o,outputEnergy:s,error:null}}const N={activeTab:"charts"};function G(){J(),X(),q(N.activeTab)}function J(){document.querySelectorAll(".accordion-header").forEach(t=>{t.addEventListener("click",()=>{const n=t.getAttribute("aria-controls"),l=document.getElementById(n),a=t.getAttribute("aria-expanded")==="true";K(t,l,!a)})})}function K(e,t,n){!e||!t||(n?(t.classList.remove("hidden"),requestAnimationFrame(()=>{t.classList.add("open"),e.setAttribute("aria-expanded","true")})):(t.classList.remove("open"),e.setAttribute("aria-expanded","false"),setTimeout(()=>{e.getAttribute("aria-expanded")==="false"&&t.classList.add("hidden")},300)))}function X(){document.querySelectorAll(".tab-link").forEach(t=>{t.addEventListener("click",n=>{n.preventDefault();const l=t.dataset.tab;l&&q(l)})})}function q(e){document.querySelectorAll(".tab-link").forEach(t=>{t.dataset.tab===e?t.classList.add("tab-active"):t.classList.remove("tab-active")}),document.querySelectorAll(".tab-content").forEach(t=>{t.id===`tab-${e}`?(t.classList.remove("hidden"),Z(t)):t.classList.add("hidden")}),N.activeTab=e}function Z(e){e.querySelectorAll("canvas").forEach(n=>{window.dispatchEvent(new Event("resize"))})}function Q(e){const t=document.getElementById("export-report-btn");t&&(t.disabled=!1,t.classList.remove("opacity-50","cursor-not-allowed"),t.classList.add("hover:bg-blue-700","shadow-md"))}function ee(){const e=document.getElementById("main-results-area");e&&window.innerWidth<1024&&e.scrollIntoView({behavior:"smooth",block:"start"})}function te(){const e=document.getElementById("report-placeholder"),t=document.getElementById("report-content");e&&e.classList.add("hidden"),t&&t.classList.remove("hidden"),q(N.activeTab)}function L(e,t,n=null){const l=document.getElementById(`card-${e}`);l&&(l.textContent=t,n&&(l.className=l.className.replace(/text-\w+-\d+/,n)))}Chart.defaults.font.family="'Inter', 'Noto Sans SC', sans-serif";Chart.defaults.font.size=20;Chart.defaults.color="#475569";Chart.defaults.scale.grid.color="#e2e8f0";Chart.defaults.scale.grid.lineWidth=1.5;Chart.defaults.plugins.legend.labels.font={size:22,weight:"bold"};Chart.defaults.plugins.legend.labels.boxWidth=24;Chart.defaults.plugins.legend.labels.padding=30;Chart.defaults.plugins.tooltip.backgroundColor="rgba(15, 23, 42, 0.95)";Chart.defaults.plugins.tooltip.titleFont={size:24,weight:"bold"};Chart.defaults.plugins.tooltip.bodyFont={size:20};Chart.defaults.plugins.tooltip.padding=20;Chart.defaults.plugins.tooltip.cornerRadius=12;Chart.defaults.plugins.tooltip.boxPadding=8;const v={hp:{fill:"rgba(37, 99, 235, 0.9)"},gas:{fill:"rgba(234, 88, 12, 0.9)"},fuel:{fill:"rgba(220, 38, 38, 0.9)"},coal:{fill:"rgba(71, 85, 105, 0.9)"},biomass:{fill:"rgba(22, 163, 74, 0.9)"},electric:{fill:"rgba(147, 51, 234, 0.9)"},steam:{fill:"rgba(8, 145, 178, 0.9)"},opex:"#f59e0b"};let x={cost:null,lcc:null};function ae(){x.cost&&(x.cost.destroy(),x.cost=null),x.lcc&&(x.lcc.destroy(),x.lcc=null)}function le(e,t,n,l){const a=s=>{if(!s)return"#cbd5e1";const r=s.toLowerCase();return r.includes("热泵")||r.includes("hp")?v.hp.fill:r.includes("气")||r.includes("gas")?v.gas.fill:r.includes("油")||r.includes("fuel")||r.includes("oil")?v.fuel.fill:r.includes("煤")||r.includes("coal")?v.coal.fill:r.includes("生物")||r.includes("bio")?v.biomass.fill:r.includes("电")||r.includes("elec")?v.electric.fill:r.includes("蒸汽")||r.includes("steam")?v.steam.fill:"#9ca3af"},o=t.map(s=>a(s));return x.cost=new Chart(e,{type:"bar",data:{labels:t,datasets:[{label:"能源成本",data:n,backgroundColor:o,borderRadius:6,stack:"Stack 0",barPercentage:.5},{label:"运维成本",data:l,backgroundColor:v.opex,borderRadius:6,stack:"Stack 0",barPercentage:.5}]},options:{responsive:!0,maintainAspectRatio:!1,interaction:{mode:"index",intersect:!1},plugins:{legend:{position:"top",align:"end"},tooltip:{callbacks:{label:s=>{let r=s.dataset.label||"";return r&&(r+=": "),s.parsed.y!==null&&(r+=parseFloat(s.parsed.y).toFixed(2)+" 万"),r},footer:s=>{let r=0;return s.forEach(function(c){r+=c.parsed.y}),"总计: "+r.toFixed(2)+" 万"}},footerFont:{size:22,weight:"bold"}}},scales:{y:{beginAtZero:!0,title:{display:!0,text:"万元/年",font:{size:18,weight:"bold"}},stacked:!0,border:{display:!1},ticks:{padding:10}},x:{stacked:!0,grid:{display:!1},ticks:{font:{size:18,weight:"bold"}}}}}}),x.cost}function oe(e,t){const n=t.map(l=>Math.abs(l));return x.lcc=new Chart(e,{type:"doughnut",data:{labels:["初始投资","全周期能源","全周期运维","残值回收"],datasets:[{data:n,backgroundColor:["#ef4444","#3b82f6","#f59e0b","#10b981"],borderWidth:0,hoverOffset:20}]},options:{responsive:!0,maintainAspectRatio:!1,cutout:"60%",plugins:{legend:{position:"right",labels:{padding:25}},tooltip:{callbacks:{label:l=>{const a=l.raw,o=l.chart._metasets[l.datasetIndex].total,s=(a/o*100).toFixed(1)+"%",r=l.label;return r==="残值回收"?` ${r}: -${a.toFixed(1)} 万 (${s})`:` ${r}: ${a.toFixed(1)} 万 (${s})`}}}}}}),x.lcc}let H=null;function re(){return`
        <div class="mb-8">
            <label class="block text-2xl font-bold text-gray-700 mb-4">项目名称</label>
            <input type="text" id="projectName" value="示例项目" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 track-change shadow-sm">
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-300">
            <label class="block text-2xl font-bold text-gray-700 mb-6">计算模式</label>
            <div class="grid grid-cols-3 gap-6">
                <label class="cursor-pointer flex flex-col items-center p-6 border-4 border-gray-100 rounded-3xl hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-600 transition-all">
                    <input type="radio" name="calcMode" value="annual" class="mb-3 w-8 h-8 accent-blue-600" checked>
                    <span class="text-2xl font-bold text-gray-800">模式A</span>
                    <span class="text-lg text-gray-500 mt-2 font-bold">(年时)</span>
                </label>
                <label class="cursor-pointer flex flex-col items-center p-6 border-4 border-gray-100 rounded-3xl hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-600 transition-all">
                    <input type="radio" name="calcMode" value="total" class="mb-3 w-8 h-8 accent-blue-600">
                    <span class="text-2xl font-bold text-gray-800">模式B</span>
                    <span class="text-lg text-gray-500 mt-2 font-bold">(总量)</span>
                </label>
                <label class="cursor-pointer flex flex-col items-center p-6 border-4 border-gray-100 rounded-3xl hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-600 transition-all">
                    <input type="radio" name="calcMode" value="daily" class="mb-3 w-8 h-8 accent-blue-600">
                    <span class="text-2xl font-bold text-gray-800">模式C</span>
                    <span class="text-lg text-gray-500 mt-2 font-bold">(间歇)</span>
                </label>
            </div>
        </div>

        <div id="input-group-load" class="space-y-8 mt-8">
            <div>
                <label class="flex justify-between items-center text-2xl font-bold text-gray-700 mb-4">
                    <span>制热负荷 (设计值)</span>
                    <select id="heatingLoadUnit" class="text-3xl font-extrabold border-none bg-transparent p-0 text-blue-600 focus:ring-0 cursor-pointer hover:text-blue-800"><option value="kW">kW</option><option value="kcal/h">kcal/h</option></select>
                </label>
                <input type="number" id="heatingLoad" data-base-value="1000" value="1000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" data-validation="isPositive">
            </div>
        </div>

        <div id="input-group-hours-a" class="space-y-8 mt-8">
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">年运行小时 (h)</label>
                <input type="number" id="operatingHours" value="2000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" data-validation="isPositive">
            </div>
        </div>

        <div id="input-group-total" class="space-y-8 mt-8 hidden">
            <div>
                <label class="flex justify-between items-center text-2xl font-bold text-gray-700 mb-4">
                    <span>年总加热量</span>
                    <select id="annualHeatingUnit" class="text-3xl font-extrabold border-none bg-transparent p-0 text-blue-600 focus:ring-0 cursor-pointer"><option value="kWh">kWh</option><option value="GJ">GJ</option><option value="万大卡">万大卡</option></select>
                </label>
                <input type="number" id="annualHeating" data-base-value="2000000" value="2000000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" data-validation="isPositive">
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">年运行小时 (反推)</label>
                <input type="number" id="operatingHours_B" value="2000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" placeholder="输入小时数">
            </div>
        </div>

        <div id="input-group-daily" class="space-y-8 mt-8 hidden">
            <div class="grid grid-cols-2 gap-8">
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">日运行 (h)</label>
                    <input type="number" id="dailyHours" value="8" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">年天数 (d)</label>
                    <input type="number" id="annualDays" value="300" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">平均负荷率 (%)</label>
                <input type="number" id="loadFactor" value="70" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
        </div>
    `}function ne(){return`
        <div class="hidden">
            <input type="radio" id="modeStandard" name="schemeAMode" value="standard" checked>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-8">
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">热泵投资 (万)</label>
                <div class="relative">
                    <input type="number" id="hpCapex" value="200" class="w-full pl-6 pr-10 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-shadow track-change shadow-sm" data-validation="isPositive">
                </div>
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">储能投资 (万)</label>
                <input type="number" id="storageCapex" value="0" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
        </div>
        
        <div class="pt-8 border-t-2 border-gray-200">
             <label class="block text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <span class="w-3 h-8 bg-blue-600 rounded-full mr-4"></span>对比基准配置
             </label>
             <div class="space-y-6">
                ${["gas|天然气|80","coal|燃煤|60","electric|电锅炉|50","steam|蒸汽|0","fuel|燃油|70","biomass|生物质|75"].map(e=>{const[t,n,l]=e.split("|");return`
                    <div class="flex items-center justify-between group related-to-${t} transition-all duration-300 p-4 rounded-2xl border-2 border-transparent hover:border-blue-100 hover:bg-blue-50/50">
                        <div class="flex items-center">
                            <input type="checkbox" id="compare_${t}" data-target="${t}" class="comparison-toggle h-10 w-10 text-blue-600 rounded-lg focus:ring-4 focus:ring-blue-500 track-change cursor-pointer accent-blue-600" checked>
                            <label for="compare_${t}" class="ml-5 text-2xl text-gray-700 font-bold cursor-pointer select-none">${n}</label>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xl text-gray-400 mr-4 font-bold">投资(万)</span>
                            <div class="relative w-44">
                                <input type="number" id="${t}BoilerCapex" value="${l}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-2xl text-right track-change focus:ring-2 focus:ring-blue-500 bg-white focus:bg-white transition-colors font-medium shadow-sm" placeholder="0">
                            </div>
                            <input type="hidden" id="${t}SalvageRate" value="${t==="steam"?0:5}">
                        </div>
                    </div>
                    `}).join("")}
             </div>
        </div>
    `}function se(){return`
        <div>
            <label class="block text-2xl font-bold text-gray-700 mb-4 tooltip-container">
                工业热泵 SPF (能效)
                <span class="tooltip-text text-lg p-4">全年综合性能系数</span>
            </label>
            <input type="number" id="hpCop" value="3.0" step="0.1" class="w-full px-6 py-5 border-2 border-blue-300 bg-blue-50 rounded-2xl text-4xl font-bold text-blue-800 track-change shadow-sm" data-validation="isStrictlyPositive">
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-200 space-y-8">
             <div>
                <div class="flex justify-between items-center mb-4">
                    <label class="block text-2xl font-bold text-gray-700">电价配置 (元/kWh)</label>
                    <button type="button" id="addPriceTierBtn" class="text-lg text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-5 py-2 rounded-xl border-2 border-blue-100">+ 添加时段</button>
                </div>
                <div id="priceTiersContainer" class="space-y-4 mb-4"></div>
                <input type="hidden" id="simple_avg_price" value="0.7" class="track-change"> 
             </div>

             <div class="grid grid-cols-2 gap-8">
                 <div class="related-to-gas">
                    <label class="block text-2xl font-bold text-gray-700 mb-4">气价 (元/m³)</label>
                    <input type="number" id="gasPrice" value="4.2" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
                <div class="related-to-coal"><label class="block text-2xl font-bold text-gray-700 mb-4">煤价 (元/t)</label><input type="number" id="coalPrice" value="1000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
                <div class="related-to-steam"><label class="block text-2xl font-bold text-gray-700 mb-4">汽价 (元/t)</label><input type="number" id="steamPrice" value="300" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
                <div class="related-to-fuel"><label class="block text-2xl font-bold text-gray-700 mb-4">油价 (元/t)</label><input type="number" id="fuelPrice" value="8900" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
                <div class="related-to-biomass"><label class="block text-2xl font-bold text-gray-700 mb-4">生物质 (元/t)</label><input type="number" id="biomassPrice" value="850" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
             </div>
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-200">
            <label class="block text-2xl font-bold text-gray-700 mb-6">锅炉效率 (%)</label>
            <div class="space-y-6">
                ${[{id:"gas",label:"气",val:92},{id:"coal",label:"煤",val:80},{id:"fuel",label:"油",val:90},{id:"biomass",label:"生物",val:85}].map(e=>`
                    <div class="flex items-center justify-between related-to-${e.id}">
                        <span class="text-2xl font-bold text-gray-600 w-20">${e.label}</span>
                        <div class="flex-1 flex items-center space-x-4">
                            <input type="number" id="${e.id}BoilerEfficiency" value="${e.val}" class="flex-1 px-6 py-4 border-2 border-gray-300 rounded-2xl text-2xl track-change shadow-sm">
                            <button type="button" class="eff-calc-btn text-blue-600 bg-blue-50 hover:bg-blue-100 px-6 py-4 rounded-2xl text-lg border-2 border-blue-200 font-bold transition-colors" data-target="${e.id}BoilerEfficiency" data-fuel="${e.id}">反推</button>
                        </div>
                    </div>
                `).join("")}
                <div class="hidden">
                    <input type="number" id="electricBoilerEfficiency" value="98">
                    <input type="number" id="steamEfficiency" value="98">
                </div>
            </div>
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-200">
            <label class="block text-2xl font-bold text-gray-700 mb-6">运维成本 (万/年)</label>
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <span class="text-2xl font-bold text-blue-600 w-32">工业热泵</span>
                    <input type="number" id="hpOpexCost" value="2.5" class="flex-1 px-6 py-4 border-2 border-blue-200 bg-blue-50 rounded-2xl text-2xl track-change shadow-sm font-bold text-blue-800">
                </div>
                ${[{id:"gas",label:"天然气",val:1.8},{id:"coal",label:"燃煤",val:6.8},{id:"electric",label:"电锅炉",val:.4},{id:"steam",label:"蒸汽",val:0},{id:"fuel",label:"燃油",val:1.9},{id:"biomass",label:"生物质",val:6.3}].map(e=>`
                    <div class="flex items-center justify-between related-to-${e.id}">
                        <span class="text-2xl font-bold text-gray-600 w-32">${e.label}</span>
                        <input type="number" id="${e.id}OpexCost" value="${e.val}" class="flex-1 px-6 py-4 border-2 border-gray-300 rounded-2xl text-2xl track-change shadow-sm">
                    </div>
                `).join("")}
            </div>
        </div>
        
        <div class="hidden">
            <input type="number" id="gasCalorific" value="35.57">
            <input type="number" id="coalCalorific" value="29.3">
            <input type="number" id="fuelCalorific" value="42.6">
            <input type="number" id="biomassCalorific" value="16.32">
            <input type="number" id="steamCalorific" value="700">
            <input type="checkbox" id="greenElectricityToggle">
            <input type="number" id="gridFactor" value="0.57">
            <input type="number" id="gasFactor" value="1.97">
            <input type="number" id="coalFactor" value="2420">
            <input type="number" id="fuelFactor" value="3090">
            <input type="number" id="steamFactor" value="0.35">
            <input type="number" id="biomassFactor" value="0">
            <input type="number" id="hybridLoadShare" value="50">
            <select id="hybridAuxHeaterType"><option value="electric">Electric</option></select>
            <input type="number" id="hybridAuxHeaterCapex" value="30">
            <input type="number" id="hybridAuxHeaterOpex" value="0.5">
            <input type="number" id="botAnnualRevenue" value="150">
            <input type="number" id="botAnnualEnergyCost" value="60">
            <input type="number" id="botAnnualOpexCost" value="5">
            <input type="number" id="botEquityRatio" value="30">
            <input type="number" id="botLoanInterestRate" value="5">
            <input type="number" id="botDepreciationYears" value="10">
            <input type="number" id="botVatRate" value="13">
            <input type="number" id="botSurtaxRate" value="12">
            <input type="number" id="botIncomeTaxRate" value="25">
             <select id="heatingLoadUnit_dummy" class="hidden"><option value="kW">kW</option></select>
             <select id="annualHeatingUnit_dummy" class="hidden"><option value="kWh">kWh</option></select>
        </div>
    `}function ie(){return`
        <div class="space-y-8">
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">分析年限 (年)</label>
                <input type="number" id="lccYears" value="15" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">折现率 (%)</label>
                <input type="number" id="discountRate" value="8" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
            <div class="grid grid-cols-2 gap-8">
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">能源涨幅(%)</label>
                    <input type="number" id="energyInflationRate" value="3" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">运维涨幅(%)</label>
                    <input type="number" id="opexInflationRate" value="5" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
            </div>
        </div>
    `}function ce(e){R("accordion-project","1. 项目与负荷",re()),R("accordion-scheme","2. 方案与投资",ne()),R("accordion-operating","3. 运行参数",se()),R("accordion-financial","4. 财务模型",ie()),G();const t=document.getElementById("calculateBtn");t&&t.addEventListener("click",()=>e()),de("heatingLoadUnit","heatingLoad"),document.querySelectorAll('input[name="calcMode"]').forEach(r=>r.addEventListener("change",W)),W(),document.querySelectorAll(".comparison-toggle").forEach(r=>r.addEventListener("change",z)),z();const a=document.getElementById("addPriceTierBtn");a&&a.addEventListener("click",()=>{D(),e()}),D("平均电价","0.7","100"),me(),ue();const o=document.getElementById("btn-reset-params");o&&o.addEventListener("click",pe);const s=document.getElementById("enableScenarioComparison");s&&(s.addEventListener("change",()=>{const r=document.getElementById("saveScenarioBtn"),c=document.querySelector('.tab-link[data-tab="scenarios"]');s.checked?(r&&r.classList.remove("hidden"),c&&c.classList.remove("hidden")):(r&&r.classList.add("hidden"),c&&c.classList.add("hidden"))}),s.dispatchEvent(new Event("change"))),window.updateSimplePriceTier=function(r){}}function D(e="",t="",n=""){const l=document.getElementById("priceTiersContainer");if(!l)return;const a=document.createElement("div");a.className="price-tier-entry flex gap-4 items-center mb-4",a.innerHTML=`
        <input type="text" class="tier-name w-1/3 px-4 py-3 border-2 border-gray-300 rounded-xl text-xl" placeholder="时段名" value="${e}">
        <input type="number" class="tier-price w-1/4 px-4 py-3 border-2 border-gray-300 rounded-xl text-xl" placeholder="价格" value="${t}">
        <span class="text-gray-400 text-xl font-bold">@</span>
        <input type="number" class="tier-dist w-1/4 px-4 py-3 border-2 border-gray-300 rounded-xl text-xl" placeholder="比例%" value="${n}">
        <button type="button" class="text-red-500 hover:text-red-700 px-4 text-3xl font-bold remove-tier-btn">×</button>
    `,a.querySelector(".remove-tier-btn").addEventListener("click",()=>{l.children.length>1?(a.remove(),document.getElementById("calculateBtn")?.click()):alert("至少保留一个电价时段")}),a.querySelectorAll("input").forEach(o=>{o.addEventListener("change",()=>document.getElementById("calculateBtn")?.click())}),l.appendChild(a)}function R(e,t,n){const l=document.getElementById(e);l&&(l.innerHTML=`
        <button class="accordion-header flex justify-between items-center w-full px-8 py-6 bg-white hover:bg-gray-50 focus:outline-none transition-colors duration-200 cursor-pointer" type="button" aria-expanded="true" aria-controls="${e}-content">
            <span class="text-3xl font-extrabold text-gray-900">${t}</span>
            <svg class="accordion-icon w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div id="${e}-content" class="accordion-content open px-8 py-8 border-t-2 border-gray-100">
            ${n}
        </div>
    `)}function W(){const e=document.querySelector('input[name="calcMode"]:checked').value;document.getElementById("input-group-load").classList.toggle("hidden",e==="total"),document.getElementById("input-group-hours-a").classList.toggle("hidden",e!=="annual"),document.getElementById("input-group-total").classList.toggle("hidden",e!=="total"),document.getElementById("input-group-daily").classList.toggle("hidden",e!=="daily")}function z(){document.querySelectorAll(".comparison-toggle").forEach(e=>{const t=e.dataset.target;document.querySelectorAll(`.related-to-${t}`).forEach(l=>{const a=l.querySelectorAll("input:not(.comparison-toggle), button");e.checked?(l.classList.remove("opacity-40","grayscale"),a.forEach(o=>o.disabled=!1)):(l.classList.add("opacity-40","grayscale"),a.forEach(o=>o.disabled=!0))})})}function de(e,t,n){const l=document.getElementById(e),a=document.getElementById(t);!l||!a||l.addEventListener("change",()=>{})}function pe(){confirm("确定要恢复默认参数吗？")&&location.reload()}function ue(){const e=document.getElementById("export-report-btn");e&&e.addEventListener("click",()=>{if(!H){alert("请先进行计算");return}be(H),setTimeout(()=>{window.print()},500)})}function be(e){const t=document.getElementById("print-report-container");if(!t)return;const n=new Date().toLocaleString("zh-CN"),l=e.comparisons.sort((d,m)=>m.annualSaving-d.annualSaving)[0];let a="",o="";const s=document.getElementById("costComparisonChart"),r=document.getElementById("lccBreakdownChart");s&&(a=s.toDataURL()),r&&(o=r.toDataURL());let c="--";l&&(c=l.irr===null||l.irr===-1/0||l.irr<-1?"无法回收":P(l.irr));const i=`
        <div class="print-header text-center mb-8 border-b pb-4">
            <h1 class="text-3xl font-bold mb-2">工业热泵经济与环境效益分析报告</h1>
            <p class="text-sm text-gray-500">项目：${e.inputs.projectName} | 生成日期: ${n}</p>
        </div>
        <div class="print-section mb-8">
            <h3 class="text-xl font-bold border-l-4 border-black pl-3 mb-4 bg-gray-100 py-1">1. 分析结论摘要</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="border p-4 rounded"><p class="text-gray-500">年节省金额</p><p class="text-2xl font-bold">${l?p(l.annualSaving):"-"} 万</p></div>
                <div class="border p-4 rounded"><p class="text-gray-500">内部收益率 (IRR)</p><p class="text-2xl font-bold">${c}</p></div>
                <div class="border p-4 rounded"><p class="text-gray-500">动态回收期</p><p class="text-2xl font-bold">${l?l.dynamicPBP:"-"} 年</p></div>
                <div class="border p-4 rounded"><p class="text-gray-500">年碳减排</p><p class="text-2xl font-bold">${l?T(l.co2Reduction,1):"-"} 吨</p></div>
            </div>
        </div>
        <div class="print-section mb-8">
            <h3 class="text-xl font-bold border-l-4 border-black pl-3 mb-4 bg-gray-100 py-1">2. 核心图表分析</h3>
            <div class="flex justify-between items-start gap-4">
                <div style="width: 48%; border:1px solid #eee; padding:10px;"><h4 class="text-center font-bold mb-2">年度成本对比</h4><img src="${a}" style="width:100%;"></div>
                <div style="width: 48%; border:1px solid #eee; padding:10px;"><h4 class="text-center font-bold mb-2">LCC 成本构成</h4><img src="${o}" style="width:100%;"></div>
            </div>
        </div>
        <div class="print-section">
            <h3 class="text-xl font-bold border-l-4 border-black pl-3 mb-4 bg-gray-100 py-1">3. 详细数据对比表</h3>
            <table class="print-table w-full text-xs border-collapse border border-gray-300">
                <thead>
                    <tr class="bg-gray-200">
                        <th class="border p-2">方案名称</th><th class="border p-2">投资(万)</th><th class="border p-2">年能耗(万)</th><th class="border p-2">年运维(万)</th><th class="border p-2">年总成本</th><th class="border p-2">年节省</th><th class="border p-2">回收期(年)</th><th class="border p-2">IRR</th><th class="border p-2">LCC总值</th><th class="border p-2">LCC节省</th><th class="border p-2">减排(t)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="border p-2 font-bold">工业热泵</td><td class="border p-2">${p(e.hp.initialInvestment)}</td><td class="border p-2">${p(e.hp.annualEnergyCost)}</td><td class="border p-2">${p(e.hp.annualOpex)}</td><td class="border p-2">${p(e.hp.annualTotalCost)}</td><td class="border p-2">-</td><td class="border p-2">-</td><td class="border p-2">-</td><td class="border p-2">${p(e.hp.lcc.total)}</td><td class="border p-2">-</td><td class="border p-2">-</td>
                    </tr>
                    ${e.comparisons.map(d=>`<tr><td class="border p-2">${d.name}</td><td class="border p-2">${p(d.initialInvestment)}</td><td class="border p-2">${p(d.annualEnergyCost)}</td><td class="border p-2">${p(d.annualOpex)}</td><td class="border p-2">${p(d.annualTotalCost)}</td><td class="border p-2 font-bold">${p(d.annualSaving)}</td><td class="border p-2">${d.dynamicPBP}</td><td class="border p-2">${d.irr===null||d.irr<-1?"N/A":P(d.irr)}</td><td class="border p-2">${p(d.lccTotal)}</td><td class="border p-2">${p(d.lccSaving)}</td><td class="border p-2">${T(d.co2,1)}</td></tr>`).join("")}
                </tbody>
            </table>
        </div>
        <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">Powered by Phoenix Plan V18.2</div>
    `;t.innerHTML=i}let A=null;function me(){const e=document.getElementById("eff-calc-modal"),t=document.getElementById("eff-calc-close-btn"),n=document.getElementById("ec-calc-btn"),l=document.getElementById("ec-apply-btn"),a=document.getElementById("ec-fuel-unit");e&&(document.body.addEventListener("click",o=>{const s=o.target.closest(".eff-calc-btn");if(s){o.preventDefault();const r=s.dataset.target,c=s.dataset.fuel;A=r;const i=document.getElementById("ec-fuel-type");i&&(i.value=c,a.textContent=c==="gas"?"m³":"kg"),e.classList.remove("hidden")}}),t&&t.addEventListener("click",()=>e.classList.add("hidden")),n&&n.addEventListener("click",()=>{const o=document.getElementById("ec-fuel-type").value,s=parseFloat(document.getElementById("ec-fuel-amount").value);let r=0;o==="gas"?r=parseFloat(document.getElementById("gasCalorific").value):o==="fuel"?r=parseFloat(document.getElementById("fuelCalorific").value):o==="coal"?r=parseFloat(document.getElementById("coalCalorific").value):o==="biomass"&&(r=parseFloat(document.getElementById("biomassCalorific").value));const c=document.querySelector('input[name="ec-output-type"]:checked').value;let i={};c==="water"?i={mass:parseFloat(document.getElementById("ec-water-mass").value),tempIn:parseFloat(document.getElementById("ec-water-in-temp").value),tempOut:parseFloat(document.getElementById("ec-water-out-temp").value)}:i={mass:parseFloat(document.getElementById("ec-steam-mass").value),pressure:parseFloat(document.getElementById("ec-steam-pressure").value),feedTemp:parseFloat(document.getElementById("ec-steam-feed-temp").value)};const d=Y(o,s,r,c,i),m=document.getElementById("ec-result-display");d.error?(m.textContent="Error",m.className="text-3xl font-black text-red-500 tracking-tight",l.disabled=!0):(m.textContent=d.efficiency.toFixed(1)+" %",m.className="text-3xl font-black text-blue-600 tracking-tight",l.disabled=!1,l.dataset.value=d.efficiency.toFixed(1))}),l&&l.addEventListener("click",()=>{if(A&&l.dataset.value){const o=document.getElementById(A);o&&(o.value=l.dataset.value,e.classList.add("hidden"),document.getElementById("calculateBtn")?.click())}}))}function ge(e){const t=r=>{const c=document.getElementById(r);return c&&parseFloat(c.value)||0},n=[];document.querySelectorAll(".price-tier-entry").forEach(r=>{n.push({name:r.querySelector(".tier-name").value,price:parseFloat(r.querySelector(".tier-price").value)||0,dist:parseFloat(r.querySelector(".tier-dist").value)||0})}),n.length===0&&n.push({name:"默认",price:.7,dist:100});const l=document.querySelector('input[name="calcMode"]:checked').value;let a=0,o=0,s=0;return l==="annual"?(a=t("heatingLoad"),o=t("operatingHours"),s=a*o):l==="total"?(s=t("annualHeating"),o=t("operatingHours_B"),a=o>0?s/o:0):(a=t("heatingLoad"),o=t("dailyHours")*t("annualDays")*(t("loadFactor")/100),s=a*o),{projectName:document.getElementById("projectName").value,analysisMode:"standard",isHybridMode:!1,priceTiers:n,heatingLoad:a,operatingHours:o,annualHeatingDemandKWh:s,lccYears:t("lccYears"),discountRate:t("discountRate")/100,energyInflationRate:t("energyInflationRate")/100,opexInflationRate:t("opexInflationRate")/100,hpHostCapex:t("hpCapex")*1e4,hpStorageCapex:t("storageCapex")*1e4,hpSalvageRate:t("hpSalvageRate")/100,hpCop:t("hpCop"),hpOpexCost:t("hpOpexCost")*1e4,gasBoilerCapex:t("gasBoilerCapex")*1e4,gasSalvageRate:.05,gasBoilerEfficiency:t("gasBoilerEfficiency")/100,gasPrice:t("gasPrice"),gasCalorific:t("gasCalorific"),gasFactor:t("gasFactor"),gasOpexCost:t("gasOpexCost")*1e4,fuelBoilerCapex:t("fuelBoilerCapex")*1e4,fuelSalvageRate:.05,fuelBoilerEfficiency:t("fuelBoilerEfficiency")/100,fuelPrice:t("fuelPrice"),fuelCalorific:t("fuelCalorific"),fuelFactor:t("fuelFactor"),fuelOpexCost:t("fuelOpexCost")*1e4,coalBoilerCapex:t("coalBoilerCapex")*1e4,coalSalvageRate:.05,coalBoilerEfficiency:t("coalBoilerEfficiency")/100,coalPrice:t("coalPrice"),coalCalorific:t("coalCalorific"),coalFactor:t("coalFactor"),coalOpexCost:t("coalOpexCost")*1e4,steamCapex:t("steamCapex")*1e4,steamSalvageRate:0,steamEfficiency:.98,steamPrice:t("steamPrice"),steamCalorific:t("steamCalorific"),steamFactor:t("steamFactor"),steamOpexCost:t("steamOpexCost")*1e4,compare:{gas:document.getElementById("compare_gas").checked,coal:document.getElementById("compare_coal").checked,fuel:document.getElementById("compare_fuel").checked,electric:document.getElementById("compare_electric").checked,steam:document.getElementById("compare_steam").checked,biomass:document.getElementById("compare_biomass").checked},biomassBoilerCapex:t("biomassBoilerCapex")*1e4,biomassSalvageRate:0,biomassBoilerEfficiency:t("biomassBoilerEfficiency")/100,biomassPrice:t("biomassPrice"),biomassCalorific:t("biomassCalorific"),biomassFactor:t("biomassFactor"),biomassOpexCost:t("biomassOpexCost")*1e4,electricBoilerCapex:t("electricBoilerCapex")*1e4,electricSalvageRate:.05,electricBoilerEfficiency:t("electricBoilerEfficiency")/100,electricOpexCost:t("electricOpexCost")*1e4,gridFactor:.57,isGreenElectricity:!1}}function fe(e){H=e,te(),ee(),Q();const t=e.comparisons.sort((a,o)=>o.annualSaving-a.annualSaving)[0];if(t){L("annual-saving",`${p(t.annualSaving)} 万`);let a="--",o="text-gray-500";t.irr===null||t.irr===-1/0||t.irr<-1?(a="无法回收",o="text-gray-500"):(a=P(t.irr),o=t.irr>.08?"text-green-600":t.irr>0?"text-yellow-600":"text-gray-500"),L("irr",a,o),L("pbp",`${t.dynamicPBP} 年`),L("co2-reduction",`${T(t.co2Reduction,1)} 吨`)}else L("annual-saving","--"),L("irr","--");setTimeout(()=>{ae();const a=["热泵",...e.comparisons.map(i=>i.name)],o=[e.hp.annualEnergyCost/1e4,...e.comparisons.map(i=>i.annualEnergyCost/1e4)],s=[e.hp.annualOpex/1e4,...e.comparisons.map(i=>i.annualOpex/1e4)],r=document.getElementById("costComparisonChart");r&&le(r,a,o,s);const c=document.getElementById("lccBreakdownChart");if(c){const i=e.hp.lcc;oe(c,[i.capex/1e4,i.energy/1e4,i.opex/1e4,i.residual/1e4])}},100);const n=document.getElementById("tab-data-table");n&&(n.innerHTML=`
            <div class="overflow-x-auto pb-6">
                <table class="min-w-full text-xl text-left text-gray-700">
                    <thead class="text-lg font-extrabold text-gray-900 uppercase bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                            <th class="px-6 py-6 whitespace-nowrap">方案名称</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">初始投资(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年能源成本(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年运维成本(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年总成本(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年节省(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-center">静态回收期</th>
                            <th class="px-6 py-6 whitespace-nowrap text-center">动态回收期</th>
                            <th class="px-6 py-6 whitespace-nowrap text-center">IRR</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">LCC总值(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">LCC节省(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">碳减排(吨)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y-2 divide-gray-100">
                        <tr class="bg-blue-50/50 border-b-2 border-gray-200 font-bold text-gray-900">
                            <td class="px-6 py-6 whitespace-nowrap">工业热泵 (本方案)</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${p(e.hp.initialInvestment)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${p(e.hp.annualEnergyCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${p(e.hp.annualOpex)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${p(e.hp.annualTotalCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${p(e.hp.lcc.total)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">-</td>
                        </tr>
                        ${e.comparisons.map(a=>`
                        <tr class="bg-white hover:bg-gray-50 transition-colors">
                            <td class="px-6 py-6 whitespace-nowrap font-bold text-gray-800">${a.name}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${p(a.initialInvestment)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${p(a.annualEnergyCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${p(a.annualOpex)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${p(a.annualTotalCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-bold text-green-600">${p(a.annualSaving)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center font-medium">${a.paybackPeriod}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center font-medium">${a.dynamicPBP} 年</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center font-bold text-blue-600">${a.irr===null||a.irr<-1?'<span class="text-gray-400">N/A</span>':P(a.irr)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${p(a.lccTotal)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right text-green-600 font-bold">${p(a.lccSaving)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right text-green-600 font-bold">${T(a.co2Reduction,1)}</td>
                        </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
            <p class="text-lg text-gray-400 mt-6">* 注：LCC (全生命周期成本) 已包含资金时间价值，折现率 ${P(e.inputs.discountRate)}。</p>
        `);const l=document.getElementById("tab-conclusion");if(l&&t){const a=t.irr>.08;l.innerHTML=`<div class="p-10 ${a?"bg-green-50 border-2 border-green-200":"bg-yellow-50 border-2 border-yellow-200"} border rounded-3xl"><h3 class="text-4xl font-extrabold ${a?"text-green-800":"text-yellow-800"} mb-6">${a?"🚀 推荐投资":"⚖️ 投资回报一般"}</h3><p class="text-2xl text-gray-700 leading-relaxed font-medium">相比于 <strong>${t.name}</strong>，工业热泵方案预计每年可节省 <strong>${p(t.annualSaving)} 万元</strong>。全生命周期（${e.inputs.lccYears}年）累计节省 <strong>${p(t.lccSaving)} 万元</strong>。静态回收期为 ${t.paybackPeriod}，动态回收期为 ${t.dynamicPBP} 年。</p></div>`}}function xe(e){const{heatingLoad:t,operatingHours:n,annualHeatingDemandKWh:l,lccYears:a,discountRate:o,energyInflationRate:s,opexInflationRate:r,hpHostCapex:c,hpStorageCapex:i,hpSalvageRate:d,hpCop:m,hpOpexCost:w,priceTiers:F}=e;let h=0;if(F&&F.length>0){let b=0,u=0;F.forEach(y=>{u+=y.price*y.dist,b+=y.dist}),h=b>0?u/b:.7}else h=.7;const g=l/m,E=g*h,k=g*e.gridFactor/1e3,f=c+i;let B=f,I=0,C=0;for(let b=1;b<=a;b++){const u=E*Math.pow(1+s,b-1),y=w*Math.pow(1+r,b-1),$=1/Math.pow(1+o,b);I+=u*$,C+=y*$}const S=f*d/Math.pow(1+o,a);return B=B+I+C-S,{avgElecPrice:h,initialInvestment:f,annualEnergyCost:E,annualOpex:w,annualTotalCost:E+w,co2:k,lcc:{total:B,capex:f,energy:I,opex:C,residual:-S}}}function ye(e,t){const n=[],l=(a,o,s,r,c,i,d,m,w)=>{if(s<=0||c<=0)return null;let h=e.annualHeatingDemandKWh*3.6/(c*s),g=0;w==="ton"?g=h/1e3*r:g=h*r;const E=h*d/1e3;let k=o;for(let u=1;u<=e.lccYears;u++){const y=g*Math.pow(1+e.energyInflationRate,u-1),$=i*Math.pow(1+e.opexInflationRate,u-1);k+=(y+$)/Math.pow(1+e.discountRate,u)}k-=o*m/Math.pow(1+e.discountRate,e.lccYears);const f=t.initialInvestment-o,B=[-f];let I="> "+e.lccYears,C=-f,O=!1,S=0;for(let u=1;u<=e.lccYears;u++){const y=g*Math.pow(1+e.energyInflationRate,u-1)+i*Math.pow(1+e.opexInflationRate,u-1),$=t.annualEnergyCost*Math.pow(1+e.energyInflationRate,u-1)+t.annualOpex*Math.pow(1+e.opexInflationRate,u-1),M=y-$;B.push(M),S+=M;const j=M/Math.pow(1+e.discountRate,u),U=C;if(C+=j,!O&&C>=0){const V=Math.abs(U)/j;I=(u-1+V).toFixed(1),O=!0}}let b=null;return f>0?S<f?b=null:b=he(B):t.annualTotalCost<g+i?b=9.99:b=null,{name:a,initialInvestment:o,annualEnergyCost:g,annualOpex:i,annualTotalCost:g+i,co2:E,lccTotal:k,annualSaving:g+i-t.annualTotalCost,energyCostSavingRate:(g-t.annualEnergyCost)/g,paybackPeriod:f>0?(f/(g+i-t.annualTotalCost)).toFixed(1)+" 年":"立即",dynamicPBP:I,irr:b,lccSaving:k-t.lcc.total,co2Reduction:E-t.co2}};return e.compare.gas&&n.push(l("天然气锅炉",e.gasBoilerCapex,e.gasBoilerEfficiency,e.gasPrice,e.gasCalorific,e.gasOpexCost,e.gasFactor,e.gasSalvageRate,"m3")),e.compare.coal&&n.push(l("燃煤锅炉",e.coalBoilerCapex,e.coalBoilerEfficiency,e.coalPrice,e.coalCalorific,e.coalOpexCost,e.coalFactor,e.coalSalvageRate,"ton")),e.compare.fuel&&n.push(l("燃油锅炉",e.fuelBoilerCapex,e.fuelBoilerEfficiency,e.fuelPrice,e.fuelCalorific,e.fuelOpexCost,e.fuelFactor,e.fuelSalvageRate,"ton")),e.compare.biomass&&n.push(l("生物质锅炉",e.biomassBoilerCapex,e.biomassBoilerEfficiency,e.biomassPrice,e.biomassCalorific,e.biomassOpexCost,e.biomassFactor,e.biomassSalvageRate,"ton")),e.compare.electric&&n.push(l("电锅炉",e.electricBoilerCapex,e.electricBoilerEfficiency,t.avgElecPrice,3.6,e.electricOpexCost,e.gridFactor,e.electricSalvageRate,"kwh")),e.compare.steam&&n.push(l("管网蒸汽",e.steamCapex,e.steamEfficiency,e.steamPrice,e.steamCalorific*3.6,e.steamOpexCost,e.steamFactor,e.steamSalvageRate,"m3")),n.filter(a=>a!==null)}function he(e,t=.1){let a=t;for(let o=0;o<100;o++){let s=0,r=0;for(let i=0;i<e.length;i++)s+=e[i]/Math.pow(1+a,i),r-=i*e[i]/Math.pow(1+a,i+1);const c=a-s/r;if(Math.abs(c-a)<1e-6)return c;a=c}return null}function _(){const e=ge();if(!e)return;const t=xe(e),n=ye(e,t);fe({inputs:e,hp:t,comparisons:n,isHybridMode:!1})}document.addEventListener("DOMContentLoaded",()=>{console.log("Phoenix Plan V17.8 Logic Fix Initializing..."),ce(_),setTimeout(()=>_(),500)});
