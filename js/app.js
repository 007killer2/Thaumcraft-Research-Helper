const researchList = document.querySelector(".researchList");
const searchResearch = document.querySelector("#searchResearch");

let allResearches = []; // глобально

const getResearchesData = async () => {
    try {
        const res = await fetch("thaumcraft_researches.json");
        const data = await res.json();

        // Преобразуем объект модов в плоский массив
        allResearches = [];
        for (const mod in data) {
            for (const key in data[mod]) {
                const research = data[mod][key];
                research.modName = mod; // сохраняем название мода
                allResearches.push(research);
            }
        }

        displayData(allResearches);
    } catch (error) {
        console.error(error);
    }
};
function displayData(data) {
    data.forEach((research) => {
        console.log(research);
        const modDiv = document.createElement('div');
        modDiv.classList.add("modContainer");
        const modPar = document.createElement("h2");
        modPar.textContent = research.modName;
        modDiv.appendChild(modPar);

        const itemDiv = document.createElement('div');
        itemDiv.classList.add("researchItem");
        const researchKeyPar = document.createElement("h3");
        researchKeyPar.textContent = `Research Key: ${research.research_key}`;

        const researchLocalNamePar = document.createElement("h4");
        researchLocalNamePar.textContent = `Research Name: ${research.research_local_name}`;

        const researchCategoryPar = document.createElement("h4");
        researchCategoryPar.textContent = `Research Category: ${research.research_category}`;

        const researchComplexityPar = document.createElement("h4");
        researchComplexityPar.textContent = `Research Complexity: ${research.research_complexity}`;


        const researchParentsList = document.createElement("ul");
        researchParentsList.textContent = "Parents: ";
        if (research.research_parents.length <= 0) {
            researchParentsList.textContent += "[]";
        }
        research.research_parents.forEach((p) => {
            const parentElement = document.createElement("li");
            const parentPar = document.createElement("p");
            parentPar.textContent = p;
            parentElement.appendChild(parentPar);
            researchParentsList.append(parentElement);
        })

        const researchHiddenParentsList = document.createElement("ul");
        researchHiddenParentsList.textContent = "Hidden Parents: ";
        if (research.research_hidden_parents.length <= 0) {
            researchHiddenParentsList.textContent += "[]";
        }
        research.research_hidden_parents.forEach((p) => {
            const parentElement = document.createElement("li");
            const parentPar = document.createElement("p");
            parentPar.textContent = p;
            parentElement.appendChild(parentPar);
            researchHiddenParentsList.append(parentElement);
        })

        itemDiv.append(researchKeyPar, researchLocalNamePar, researchCategoryPar, researchComplexityPar, researchParentsList, researchHiddenParentsList);

        modDiv.appendChild(itemDiv);

        researchList.appendChild(modDiv)
    })
    // for (const mod in data) {
    //     const modDiv = document.createElement('div');
    //     modDiv.classList.add("modContainer");
    //     const modPar = document.createElement("h2");
    //     modPar.textContent = mod;
    //     modDiv.appendChild(modPar);
    //
    //     data.forEach((research) => {

    //     });
    // }
}

searchResearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const searchValue = event.target.value;
    console.log(searchValue);
    const filteredResearches = allResearches.filter(r => {
        console.log("R: ",  r.research_category);
        return r.research_key.includes(searchValue) ||
            r.research_local_name.includes(searchValue) ||
            r.research_category.includes(searchValue) ||
            r.research_parents.some(p => p.includes(searchValue)) ||
            r.research_hidden_parents.some(p => p.includes(searchValue));
    });

    // Очищаем контейнер и рендерим результат
    researchList.innerHTML = "";
    displayData(filteredResearches);
});
(async () => {
    await getResearchesData();

})();