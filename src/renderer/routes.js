import LoadingPage from "./pages/Loading.svelte";
import LicensePage from "./pages/License.svelte";
import ActionsPage from "./pages/Actions.svelte";
import PlatformsPage from "./pages/Platforms.svelte";
import PerformActionPage from "./pages/PerformAction.svelte";

export default {
    "/": PlatformsPage,
    "/install": PerformActionPage,
    "*": LoadingPage,
};
