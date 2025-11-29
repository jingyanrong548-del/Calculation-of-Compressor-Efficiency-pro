// src/js/main.js
// V17.8: High Precision DPP Calculation

import '../css/style.css'; 
import { initializeUI, readAllInputs, renderDashboard } from './ui.js';
import { showGlobalNotification } from './ui-dashboard.js';

function calculateLCC(inputs) {
    const {
        heatingLoad, operatingHours, annualHeatingDemandKWh,
        lccYears, discountRate, energyInflationRate, opexInflationRate,
        hpHostCapex, hpStorageCapex, hpSalvageRate, hpCop, hpOpexCost,
        priceTiers
    } = inputs;

    let avgElecPrice = 0;
    if (priceTiers && priceTiers.length > 0) {
        let totalWeight = 0;
        let weightedSum = 0;
        priceTiers.forEach(t => {
            weightedSum += t.price * t.dist;
            totalWeight += t.dist;
        });
        avgElecPrice = totalWeight > 0 ? weightedSum / totalWeight : 0.7;
    } else {
        avgElecPrice = 0.7; 
    }

    const hpElecConsumption = annualHeatingDemandKWh / hpCop;
    const hpAnnualEnergyCost = hpElecConsumption * avgElecPrice;
    const hpCo2 = (hpElecConsumption * inputs.gridFactor) / 1000; 

    const totalCapex = hpHostCapex + hpStorageCapex;
    let totalNPV = totalCapex;
    let energyNPV = 0;
    let opexNPV = 0;
    
    for (let y = 1; y <= lccYears; y++) {
        const yearEnergyCost = hpAnnualEnergyCost * Math.pow(1 + energyInflationRate, y - 1);
        const yearOpexCost = hpOpexCost * Math.pow(1 + opexInflationRate, y - 1);
        const discountFactor = 1 / Math.pow(1 + discountRate, y);
        energyNPV += yearEnergyCost * discountFactor;
        opexNPV += yearOpexCost * discountFactor;
    }
    
    const salvageValue = totalCapex * hpSalvageRate;
    const salvageNPV = salvageValue / Math.pow(1 + discountRate, lccYears);
    totalNPV = totalNPV + energyNPV + opexNPV - salvageNPV;

    return {
        avgElecPrice, 
        initialInvestment: totalCapex,
        annualEnergyCost: hpAnnualEnergyCost,
        annualOpex: hpOpexCost,
        annualTotalCost: hpAnnualEnergyCost + hpOpexCost,
        co2: hpCo2,
        lcc: { total: totalNPV, capex: totalCapex, energy: energyNPV, opex: opexNPV, residual: -salvageNPV }
    };
}

function calculateComparison(inputs, hpResult) {
    const comparisons = [];
    
    const calcOne = (name, capex, eff, price, calorific, opex, factor, salvageRate, unitType) => {
        if (eff <= 0 || calorific <= 0) return null;
        
        const demandMJ = inputs.annualHeatingDemandKWh * 3.6; 
        let consumption = demandMJ / (calorific * eff); 
        
        let annualEnergyCost = 0;
        if (unitType === 'ton') {
            annualEnergyCost = (consumption / 1000) * price;
        } else {
            annualEnergyCost = consumption * price;
        }

        const co2 = (consumption * factor) / 1000; 

        let lcc = capex;
        for (let y = 1; y <= inputs.lccYears; y++) {
            const e = annualEnergyCost * Math.pow(1 + inputs.energyInflationRate, y - 1);
            const o = opex * Math.pow(1 + inputs.opexInflationRate, y - 1);
            lcc += (e + o) / Math.pow(1 + inputs.discountRate, y);
        }
        lcc -= (capex * salvageRate) / Math.pow(1 + inputs.discountRate, inputs.lccYears);

        const deltaI = hpResult.initialInvestment - capex;
        const savingsStream = [-deltaI]; 
        
        // [修复] 高精度动态回收期计算
        let dynamicPBP = "> " + inputs.lccYears;
        let cumulativeDCF = -deltaI;
        let recovered = false;
        
        let totalRawSavings = 0;

        for (let y = 1; y <= inputs.lccYears; y++) {
            const costBoiler = annualEnergyCost * Math.pow(1 + inputs.energyInflationRate, y-1) + opex * Math.pow(1 + inputs.opexInflationRate, y-1);
            const costHP = hpResult.annualEnergyCost * Math.pow(1 + inputs.energyInflationRate, y-1) + hpResult.annualOpex * Math.pow(1 + inputs.opexInflationRate, y-1);
            const saving = costBoiler - costHP;
            
            savingsStream.push(saving);
            totalRawSavings += saving;
            
            const dcf = saving / Math.pow(1 + inputs.discountRate, y);
            const prevDCF = cumulativeDCF;
            cumulativeDCF += dcf;
            
            if (!recovered && cumulativeDCF >= 0) {
                // 线性插值计算小数年
                // prevDCF 是负数 (还差多少钱)
                // dcf 是今年赚的折现钱
                // 比例 = abs(prevDCF) / dcf
                const fraction = Math.abs(prevDCF) / dcf;
                dynamicPBP = ((y - 1) + fraction).toFixed(1); // 例如 1.2
                recovered = true;
            }
        }

        let irr = null;
        if (deltaI > 0) {
             if (totalRawSavings < deltaI) {
                 irr = null; 
             } else {
                 irr = calculateIRR(savingsStream);
             }
        } else {
            if (hpResult.annualTotalCost < (annualEnergyCost + opex)) {
                irr = 9.99; 
            } else {
                irr = null;
            }
        }
        
        return {
            name, initialInvestment: capex, annualEnergyCost, annualOpex: opex, annualTotalCost: annualEnergyCost + opex,
            co2, lccTotal: lcc, annualSaving: (annualEnergyCost + opex) - hpResult.annualTotalCost,
            energyCostSavingRate: (annualEnergyCost - hpResult.annualEnergyCost) / annualEnergyCost,
            paybackPeriod: deltaI > 0 ? (deltaI / ((annualEnergyCost+opex) - hpResult.annualTotalCost)).toFixed(1) + " 年" : "立即",
            dynamicPBP: dynamicPBP, // 现在是字符串 "1.2"
            irr, lccSaving: lcc - hpResult.lcc.total, co2Reduction: co2 - hpResult.co2
        };
    };

    if (inputs.compare.gas) comparisons.push(calcOne('天然气锅炉', inputs.gasBoilerCapex, inputs.gasBoilerEfficiency, inputs.gasPrice, inputs.gasCalorific, inputs.gasOpexCost, inputs.gasFactor, inputs.gasSalvageRate, 'm3'));
    if (inputs.compare.coal) comparisons.push(calcOne('燃煤锅炉', inputs.coalBoilerCapex, inputs.coalBoilerEfficiency, inputs.coalPrice, inputs.coalCalorific, inputs.coalOpexCost, inputs.coalFactor, inputs.coalSalvageRate, 'ton'));
    if (inputs.compare.fuel) comparisons.push(calcOne('燃油锅炉', inputs.fuelBoilerCapex, inputs.fuelBoilerEfficiency, inputs.fuelPrice, inputs.fuelCalorific, inputs.fuelOpexCost, inputs.fuelFactor, inputs.fuelSalvageRate, 'ton'));
    if (inputs.compare.biomass) comparisons.push(calcOne('生物质锅炉', inputs.biomassBoilerCapex, inputs.biomassBoilerEfficiency, inputs.biomassPrice, inputs.biomassCalorific, inputs.biomassOpexCost, inputs.biomassFactor, inputs.biomassSalvageRate, 'ton'));
    if (inputs.compare.electric) comparisons.push(calcOne('电锅炉', inputs.electricBoilerCapex, inputs.electricBoilerEfficiency, hpResult.avgElecPrice, 3.6, inputs.electricOpexCost, inputs.gridFactor, inputs.electricSalvageRate, 'kwh'));
    if (inputs.compare.steam) comparisons.push(calcOne('管网蒸汽', inputs.steamCapex, inputs.steamEfficiency, inputs.steamPrice, inputs.steamCalorific * 3.6, inputs.steamOpexCost, inputs.steamFactor, inputs.steamSalvageRate, 'm3'));

    return comparisons.filter(c => c !== null);
}

function calculateIRR(cashFlows, guess = 0.1) {
    const maxIter = 100; const tol = 1e-6; let x = guess;
    for (let i = 0; i < maxIter; i++) {
        let f = 0; let df = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            f += cashFlows[t] / Math.pow(1 + x, t);
            df -= t * cashFlows[t] / Math.pow(1 + x, t + 1);
        }
        const newX = x - f / df;
        if (Math.abs(newX - x) < tol) return newX;
        x = newX;
    }
    return null; 
}

function handleCalculate() {
    const inputs = readAllInputs((msg) => alert(msg));
    if (!inputs) return;
    const hpResult = calculateLCC(inputs);
    const comparisons = calculateComparison(inputs, hpResult);
    const results = { inputs, hp: hpResult, comparisons, isHybridMode: false };
    renderDashboard(results);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Phoenix Plan V17.8 Logic Fix Initializing...');
    initializeUI(handleCalculate);
    setTimeout(() => handleCalculate(), 500);
});