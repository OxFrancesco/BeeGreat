import { renderToString } from "react-dom/server";
import { Showcase } from "./main";
export const render = () => renderToString(<Showcase />);
