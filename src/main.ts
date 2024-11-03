import "./style.css";

const app: HTMLDivElement = document.querySelector("#app")!;

const gameName = "D3";
document.title = gameName;

const header = document.createElement("h1");
header.innerHTML = gameName;
app.append(header);

const testButton = document.createElement("button");
testButton.innerHTML = "Click";
app.append(testButton);

testButton.addEventListener("click", () => {
    alert("You clicked the button!");
})