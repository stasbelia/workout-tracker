import React from 'react';
import { Stack } from 'expo-router';
import { cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import OneRepMaxScreen from '../src/screens/OneRepMaxScreen';
import { calculateOneRepMax, formatKg } from '../src/calculators/oneRepMax';
import { ThemeProvider } from '../src/ui/theme';
import * as SecureStore from 'expo-secure-store';
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn()}));
afterEach(cleanup);
function result(weight:string,reps:string){const r=calculateOneRepMax(weight,reps);if(typeof r==='string')throw new Error(r);return r;}
test('Еплі: 100 кг × 6 дає 120 кг, 75% дорівнюють 90 кг; кома підтримується',()=>{
 const r=result('100','6');expect(r.estimatedKg).toBe(120);expect(r.percentages.find(p=>p.percent===75)?.weightKg).toBe(90);expect(result('42,5','6').estimatedKg).toBe(51);expect(result('60','10').estimatedKg).toBe(80);
});
test('одне повторення не отримує завищення формулою',()=>{
 expect(result('42,5','1').estimatedKg).toBe(42.5);expect(formatKg(result('1000','10').estimatedKg)).toBe('1333,3');expect(formatKg(42.5)).toBe('42,5');expect(formatKg(120)).toBe('120');
});
test('нуль, від’ємні, нечислові значення й понад 1000 повторень відхиляються',()=>{
 for(const weight of ['','0','-1','1001','1e2','NaN','Infinity','40.555','40,5.5'])expect(typeof calculateOneRepMax(weight,'5')).toBe('string');
 for(const reps of ['','0','-1','1001','1.5','1e1','abc'])expect(typeof calculateOneRepMax('40',reps)).toBe('string');
});
test('понад 10 повторень можна розрахувати; один повтор і колишня межа 10 залишаються правильними',()=>{
 expect(result('60','15').estimatedKg).toBe(90);
 expect(result('60','20').estimatedKg).toBeCloseTo(100);
 expect(result('60','10').estimatedKg).toBe(80);
 expect(result('60','1').estimatedKg).toBe(60);
 expect(Number.isFinite(result('1000','1000').estimatedKg)).toBe(true);
});
test('для 15 повторень показується результат із попередженням; після зміни вводу воно прибирається',async()=>{
 await renderRouter({_layout:()=> <Stack/>,index:OneRepMaxScreen});
 await fireEvent.changeText(screen.getByLabelText('Вага для розрахунку 1RM'),'60');
 await fireEvent.changeText(screen.getByLabelText('Кількість повторень для 1RM'),'15');
 await fireEvent.press(screen.getByRole('button',{name:'Розрахувати 1RM'}));
 expect(screen.getByLabelText('Результат 1RM: 90 кг')).toBeTruthy();expect(screen.getByRole('alert')).toHaveTextContent(/Понад 10 повторень/);
 await fireEvent.changeText(screen.getByLabelText('Кількість повторень для 1RM'),'10');expect(screen.queryByRole('alert')).toBeNull();
 await fireEvent.press(screen.getByRole('button',{name:'Розрахувати 1RM'}));expect(screen.getByLabelText('Результат 1RM: 80 кг')).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();
});
test('калькулятор рахує без мережі та прибирає старий результат після зміни вводу',async()=>{
 const original=global.fetch,fetchMock=jest.fn();global.fetch=fetchMock;
 try{
 await renderRouter({_layout:()=> <Stack/>,index:OneRepMaxScreen});await fireEvent.changeText(screen.getByLabelText('Вага для розрахунку 1RM'),'100');await fireEvent.changeText(screen.getByLabelText('Кількість повторень для 1RM'),'6');await fireEvent.press(screen.getByRole('button',{name:'Розрахувати 1RM'}));expect(screen.getByLabelText('Результат 1RM: 120 кг')).toBeTruthy();expect(screen.getByText('90 кг')).toBeTruthy();expect(fetchMock).not.toHaveBeenCalled();
 await fireEvent.changeText(screen.getByLabelText('Вага для розрахунку 1RM'),'0');expect(screen.queryByLabelText('Результат 1RM: 120 кг')).toBeNull();await fireEvent.press(screen.getByRole('button',{name:'Розрахувати 1RM'}));await screen.findByRole('alert');expect(fetchMock).not.toHaveBeenCalled();
 }finally{global.fetch=original;}
});
test('світла тема застосовується до калькулятора',async()=>{
 jest.mocked(SecureStore.getItemAsync).mockResolvedValue('light');await renderRouter({_layout:()=> <ThemeProvider><Stack/></ThemeProvider>,index:OneRepMaxScreen});await screen.findByLabelText('Вага для розрахунку 1RM');expect(screen.getByLabelText('Вага для розрахунку 1RM')).toHaveStyle({color:'#182116'});
});
